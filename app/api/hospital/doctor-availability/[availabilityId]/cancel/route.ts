import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import AppointmentSlot from "@/models/AppointmentSlot";
import DoctorAvailability from "@/models/DoctorAvailability";

type RouteContext = { params: Promise<{ availabilityId: string }> };

const cancelSchema = z.object({
  cancellationReason: z.string().optional(),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_availability_cancel");
    if (session.user.role === "DOCTOR") {
      throw new Error("Forbidden: doctors cannot cancel availability");
    }
    const { availabilityId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const body = cancelSchema.parse(await req.json());
    await connectDb();

    const availability = await DoctorAvailability.findOne({ hospitalId, availabilityId });
    if (!availability) return errorResponse("Doctor availability not found", 404);
    if (availability.status !== "Active") {
      return errorResponse("Only Active availability can be cancelled", 409);
    }

    // Reject if booked slots exist — require manual resolution first
    const bookedSlots = await AppointmentSlot.countDocuments({
      hospitalId,
      availabilityId,
      bookedCount: { $gt: 0 },
    });

    if (bookedSlots > 0) {
      return errorResponse(
        `Cannot cancel availability with ${bookedSlots} booked slot(s). Handle existing appointments first.`,
        409,
      );
    }

    // Safe to cancel: cancel availability and block/cancel its unbooked slots
    await AppointmentSlot.updateMany(
      { hospitalId, availabilityId, bookedCount: 0, status: "Available" },
      { $set: { status: "Cancelled", updatedBy: session.payload.userId } },
    );

    availability.status = "Cancelled";
    availability.cancelledAt = new Date();
    availability.cancellationReason = body.cancellationReason ?? "";
    availability.updatedBy = session.payload.userId;
    await availability.save();

    return successResponse(serializeDoc(availability), "Doctor availability cancelled");
  } catch (error) {
    return handleApiError(error);
  }
}
