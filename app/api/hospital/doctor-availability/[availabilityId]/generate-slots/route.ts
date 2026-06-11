import { NextRequest } from "next/server";
import { errorResponse, handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import AppointmentSlot from "@/models/AppointmentSlot";
import DoctorAvailability from "@/models/DoctorAvailability";

type RouteContext = { params: Promise<{ availabilityId: string }> };

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "doctor_slots_generate");
    if (session.user.role === "DOCTOR") {
      throw new Error("Forbidden: doctors cannot generate slots");
    }
    const { availabilityId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const availability = await DoctorAvailability.findOne({ hospitalId, availabilityId });
    if (!availability) return errorResponse("Doctor availability not found", 404);
    if (availability.status !== "Active") {
      return errorResponse("Can only generate slots for Active availability", 409);
    }

    const startMinutes = timeToMinutes(availability.startTime);
    const endMinutes = timeToMinutes(availability.endTime);
    const breakStart = availability.breakStartTime ? timeToMinutes(availability.breakStartTime) : null;
    const breakEnd = availability.breakEndTime ? timeToMinutes(availability.breakEndTime) : null;
    const duration = availability.slotDurationMinutes;

    // Build list of slot windows skipping break
    const slotWindows: { startTime: string; endTime: string }[] = [];
    let cursor = startMinutes;
    while (cursor + duration <= endMinutes) {
      const slotEnd = cursor + duration;
      // Skip if slot overlaps break
      const overlapsBreak =
        breakStart !== null &&
        breakEnd !== null &&
        cursor < breakEnd &&
        slotEnd > breakStart;

      if (!overlapsBreak) {
        slotWindows.push({ startTime: minutesToTime(cursor), endTime: minutesToTime(slotEnd) });
      }
      cursor += duration;
    }

    if (slotWindows.length === 0) {
      return errorResponse("No slots could be generated from the given availability window", 422);
    }

    // Upsert slots: create missing, skip existing
    let created = 0;
    let existing = 0;
    let skipped = 0;

    // Fetch current slot IDs counter once to avoid N separate queries
    let slotCounter = 0;
    {
      const year = new Date().getFullYear();
      const prefix = `SLT-${year}-`;
      const latest = await AppointmentSlot.findOne({ hospitalId, slotId: { $regex: `^${prefix}` } })
        .sort({ slotId: -1 })
        .select("slotId");
      slotCounter = latest?.slotId ? Number(latest.slotId.slice(prefix.length)) : 0;
    }

    const year = new Date().getFullYear();
    const prefix = `SLT-${year}-`;

    for (const window of slotWindows) {
      const exists = await AppointmentSlot.findOne({
        hospitalId,
        doctorUserId: availability.doctorUserId,
        date: availability.date,
        startTime: window.startTime,
      });

      if (exists) {
        existing++;
        continue;
      }

      slotCounter++;
      const slotId = `${prefix}${String(slotCounter).padStart(4, "0")}`;

      try {
        await AppointmentSlot.create({
          hospitalId,
          slotId,
          availabilityId,
          doctorUserId: availability.doctorUserId,
          doctorProfileId: availability.doctorProfileId ?? "",
          departmentId: availability.departmentId ?? "",
          date: availability.date,
          startTime: window.startTime,
          endTime: window.endTime,
          durationMinutes: duration,
          maxBookings: availability.maxPatientsPerSlot,
          bookedCount: 0,
          status: "Available",
          location: availability.location ?? "",
          room: availability.room ?? "",
          notes: availability.notes ?? "",
          createdBy: session.payload.userId,
        });
        created++;
      } catch {
        skipped++;
      }
    }

    return successResponse(
      { result: { createdCount: created, existingCount: existing, skippedCount: skipped } },
      `Slot generation complete: ${created} created, ${existing} already existed`,
      200,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
