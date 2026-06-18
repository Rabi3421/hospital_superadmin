import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";

const triageUpdateSchema = z.object({
  triageStatus: z.enum(["Pending", "In Triage", "Ready For Doctor", "Completed"]),
  triagePriority: z.enum(["Low", "Normal", "High", "Critical"]),
  triageNotes: z.string().optional(),
});

type RouteContext = { params: Promise<{ appointmentId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nurse_triage_update");
    const { appointmentId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const body = triageUpdateSchema.parse(await req.json());
    await connectDb();

    const appointment = await Appointment.findOne({ hospitalId, appointmentId });
    if (!appointment) return errorResponse("Appointment not found", 404);

    const activeStatuses = ["Scheduled", "Checked In", "In Consultation"];
    if (!activeStatuses.includes(appointment.status)) {
      return errorResponse("Appointment is not in an active status for triage", 409);
    }

    appointment.triageStatus = body.triageStatus;
    appointment.triagePriority = body.triagePriority;
    if (body.triageNotes !== undefined) appointment.triageNotes = body.triageNotes;

    if (body.triageStatus === "Ready For Doctor") {
      appointment.nurseReadyAt = new Date();
    }

    await appointment.save();

    return successResponse(serializeDoc(appointment), "Triage updated");
  } catch (error) {
    return handleApiError(error);
  }
}
