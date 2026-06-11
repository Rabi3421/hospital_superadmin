import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { departmentUpdateSchema } from "@/lib/hospital-management";
import HospitalDepartment from "@/models/HospitalDepartment";

type RouteContext = { params: Promise<{ departmentId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "departments_view");
    const { departmentId } = await context.params;
    await connectDb();
    const department = await HospitalDepartment.findOne({ _id: departmentId, hospitalId: session.payload.hospitalId });
    if (!department) return errorResponse("Department not found", 404);
    return successResponse(serializeDoc(department), "Department fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "departments_update");
    const { departmentId } = await context.params;
    const body = departmentUpdateSchema.parse(await req.json());
    await connectDb();
    const department = await HospitalDepartment.findOneAndUpdate(
      { _id: departmentId, hospitalId: session.payload.hospitalId },
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!department) return errorResponse("Department not found", 404);
    return successResponse(serializeDoc(department), "Department updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "departments_delete");
    const { departmentId } = await context.params;
    await connectDb();
    const department = await HospitalDepartment.findOneAndUpdate(
      { _id: departmentId, hospitalId: session.payload.hospitalId },
      { $set: { status: "Inactive" } },
      { new: true },
    );
    if (!department) return errorResponse("Department not found", 404);
    return successResponse(serializeDoc(department), "Department deactivated");
  } catch (error) {
    return handleApiError(error);
  }
}
