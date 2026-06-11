import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "appointment_requests_view");
    const status = req.nextUrl.searchParams.get("status");
    const filter: Record<string, unknown> = { hospitalId: session.payload.hospitalId };
    if (status) filter.status = status;
    await connectDb();
    return successResponse(serializeDoc(await HospitalAppointmentRequest.find(filter).sort({ createdAt: -1 })), "Appointment requests fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
