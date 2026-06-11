import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertTransition, loadAppointmentForHospital } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";

const cancelSchema = z.object({
  cancellationReason: z.string().optional(),
});

type RouteContext = { params: Promise<{ appointmentId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "appointments_cancel");
    const { appointmentId } = await context.params;
    const body = cancelSchema.parse(await req.json().catch(() => ({})));
    await connectDb();

    const appointment = await loadAppointmentForHospital(session.payload.hospitalId, appointmentId);
    if (!appointment) return errorResponse("Appointment not found", 404);

    assertTransition(appointment, ["Scheduled", "Checked In"], "Cancelled");
    appointment.status = "Cancelled";
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = body.cancellationReason ?? "";
    await appointment.save();

    return successResponse(serializeDoc(appointment), "Appointment cancelled");
  } catch (error) {
    return handleApiError(error);
  }
}
