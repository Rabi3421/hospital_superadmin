import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { validateAppointmentRefs } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import AppointmentSlot from "@/models/AppointmentSlot";
import DoctorAvailability from "@/models/DoctorAvailability";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";

type RouteContext = { params: Promise<{ availabilityId: string }> };

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const patchSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDurationMinutes: z.number().int().positive().optional(),
  breakStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  breakEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  maxPatientsPerSlot: z.number().int().min(1).optional(),
  location: z.string().optional(),
  room: z.string().optional(),
  notes: z.string().optional(),
  departmentId: z.string().optional().or(z.literal("")),
  doctorProfileId: z.string().optional().or(z.literal("")),
});

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_availability_view");
    const { availabilityId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, availabilityId };
    if (session.user.role === "DOCTOR") {
      filter.doctorUserId = session.payload.userId;
    }

    const availability = await DoctorAvailability.findOne(filter);
    if (!availability) return errorResponse("Doctor availability not found", 404);

    return successResponse({ availability: serializeDoc(availability) }, "Doctor availability fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_availability_update");
    if (session.user.role === "DOCTOR") {
      throw new Error("Forbidden: doctors cannot update availability");
    }
    const { availabilityId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const body = patchSchema.parse(await req.json());
    await connectDb();

    const availability = await DoctorAvailability.findOne({ hospitalId, availabilityId });
    if (!availability) return errorResponse("Doctor availability not found", 404);
    if (availability.status !== "Active") {
      return errorResponse("Cannot update non-active availability", 409);
    }

    // Check if any slots are booked — restrict time/duration changes if so
    const bookedSlotsExist = await AppointmentSlot.exists({
      hospitalId,
      availabilityId,
      bookedCount: { $gt: 0 },
    });

    if (bookedSlotsExist && (body.startTime || body.endTime || body.slotDurationMinutes)) {
      return errorResponse("Cannot change time/duration when booked slots exist", 409);
    }

    // Validate time ordering if times are being changed
    const startTime = body.startTime ?? availability.startTime;
    const endTime = body.endTime ?? availability.endTime;
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      throw new Error("endTime must be after startTime");
    }

    const breakStart = body.breakStartTime ?? availability.breakStartTime ?? "";
    const breakEnd = body.breakEndTime ?? availability.breakEndTime ?? "";
    if (breakStart && breakEnd) {
      const bs = timeToMinutes(breakStart);
      const be = timeToMinutes(breakEnd);
      if (bs >= be) throw new Error("breakEndTime must be after breakStartTime");
      if (bs < timeToMinutes(startTime) || be > timeToMinutes(endTime)) {
        throw new Error("Break period must fall within start/end time");
      }
    }

    if (body.doctorProfileId) {
      const profile = await HospitalDoctorPublicProfile.findOne({
        hospitalId,
        _id: body.doctorProfileId,
        status: "Active",
      });
      if (!profile) throw new Error("Doctor profile not found or inactive for this hospital");
    }

    if (body.departmentId) {
      await validateAppointmentRefs({ hospitalId, departmentId: body.departmentId || undefined });
    }

    const updates: Record<string, unknown> = { updatedBy: session.payload.userId };
    for (const key of Object.keys(body) as Array<keyof typeof body>) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    Object.assign(availability, updates);
    await availability.save();

    return successResponse(serializeDoc(availability), "Doctor availability updated");
  } catch (error) {
    return handleApiError(error);
  }
}
