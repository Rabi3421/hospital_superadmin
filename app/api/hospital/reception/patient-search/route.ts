import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { escapeRegex } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "patient_search");
    const hospitalId = session.payload.hospitalId;
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim() ?? "";
    await connectDb();

    if (!search) return successResponse([], "Patient search results");

    const regex = new RegExp(escapeRegex(search), "i");
    const patients = await Patient.find({
      hospitalId,
      $or: [{ patientId: regex }, { name: regex }, { phone: regex }, { email: regex }],
    })
      .select("patientId name phone email gender age status")
      .sort({ createdAt: -1 })
      .limit(20);

    return successResponse(serializeDoc(patients), "Patient search results");
  } catch (error) {
    return handleApiError(error);
  }
}
