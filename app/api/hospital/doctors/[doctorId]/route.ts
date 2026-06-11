import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { doctorProfileUpdateSchema, validateDoctorProfileReferences } from "@/lib/hospital-management";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";

type RouteContext = { params: Promise<{ doctorId: string }> };

async function enrichOne(doc: Awaited<ReturnType<typeof HospitalDoctorPublicProfile.findOne>>) {
  if (!doc) return null;
  let departmentName = "";
  if (doc.departmentId) {
    const dept = await HospitalDepartment.findOne({ _id: doc.departmentId }).select("name");
    departmentName = dept?.name ?? "";
  }
  return { ...doc.toObject(), departmentName };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_profiles_view");
    const { doctorId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const doctor = await HospitalDoctorPublicProfile.findOne({ doctorId, hospitalId });
    if (!doctor) return errorResponse("Doctor profile not found", 404);

    const enriched = await enrichOne(doctor);
    return successResponse({ doctor: serializeDoc(enriched) }, "Doctor profile fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_profiles_update");
    const { doctorId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const body = doctorProfileUpdateSchema.parse(await req.json());

    await connectDb();
    await validateDoctorProfileReferences(hospitalId, body);

    const doctor = await HospitalDoctorPublicProfile.findOneAndUpdate(
      { doctorId, hospitalId },
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!doctor) return errorResponse("Doctor profile not found", 404);

    const enriched = await enrichOne(doctor);
    return successResponse({ doctor: serializeDoc(enriched) }, "Doctor profile updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_profiles_delete");
    const { doctorId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const doctor = await HospitalDoctorPublicProfile.findOneAndUpdate(
      { doctorId, hospitalId },
      { $set: { status: "Inactive" } },
    );
    if (!doctor) return errorResponse("Doctor profile not found", 404);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
