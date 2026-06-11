import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import AppointmentSlot from "@/models/AppointmentSlot";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "doctor_slots_view");
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    if (session.user.role === "DOCTOR") {
      filter.doctorUserId = session.payload.userId;
    } else {
      const doctorUserId = req.nextUrl.searchParams.get("doctorUserId")?.trim();
      if (doctorUserId) filter.doctorUserId = doctorUserId;
    }

    const date = req.nextUrl.searchParams.get("date")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    if (date) filter.date = date;
    if (status) filter.status = status;

    const [slots, total] = await Promise.all([
      AppointmentSlot.find(filter).sort({ date: -1, startTime: 1 }).skip(skip).limit(limit),
      AppointmentSlot.countDocuments(filter),
    ]);

    // For booked slots, enrich with patient appointment summary
    const slotIds = slots.filter((s) => s.bookedCount > 0).map((s) => s.slotId);
    const appointments = await Appointment.find({
      hospitalId,
      slotId: { $in: slotIds },
    }).select("appointmentId slotId patientId tokenNumber status scheduledStartTime");

    const patientIds = [...new Set(appointments.map((a) => a.patientId).filter(Boolean))];
    const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select(
      "patientId name phone gender age",
    );
    const patientById = new Map(patients.map((p) => [p.patientId, p]));

    const apptsBySlotId = new Map<string, unknown[]>();
    for (const appt of appointments) {
      const slotId = appt.slotId ?? "";
      if (!apptsBySlotId.has(slotId)) apptsBySlotId.set(slotId, []);
      apptsBySlotId.get(slotId)!.push({
        appointmentId: appt.appointmentId,
        tokenNumber: appt.tokenNumber,
        status: appt.status,
        scheduledStartTime: appt.scheduledStartTime,
        patient: patientById.get(appt.patientId) ?? null,
      });
    }

    const enriched = slots.map((slot) => ({
      ...slot.toObject(),
      appointments: apptsBySlotId.get(slot.slotId) ?? [],
      availableSeats: slot.maxBookings - slot.bookedCount,
    }));

    return successResponse(serializeDoc(enriched), "Doctor slots fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
