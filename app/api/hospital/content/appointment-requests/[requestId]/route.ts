import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { appointmentRequestUpdateSchema } from "@/lib/hospital-content";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "appointment_requests_view");
    const { requestId } = await context.params;
    await connectDb();
    const request = await HospitalAppointmentRequest.findOne({ _id: requestId, hospitalId: session.payload.hospitalId });
    if (!request) return errorResponse("Appointment request not found", 404);
    return successResponse(serializeDoc(request), "Appointment request fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "appointment_requests_update");
    const { requestId } = await context.params;
    const body = appointmentRequestUpdateSchema.parse(await req.json());
    await connectDb();
    const request = await HospitalAppointmentRequest.findOneAndUpdate(
      { _id: requestId, hospitalId: session.payload.hospitalId },
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!request) return errorResponse("Appointment request not found", 404);
    return successResponse(serializeDoc(request), "Appointment request updated");
  } catch (error) {
    return handleApiError(error);
  }
}
