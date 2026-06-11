import { NextRequest } from "next/server";
import { handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import AppointmentSlot from "@/models/AppointmentSlot";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "doctor_queue_view");
    const hospitalId = session.payload.hospitalId;
    const dateParam = req.nextUrl.searchParams.get("date");
    const today = dateRangeFor(dateParam ?? new Date());

    const baseFilter: Record<string, unknown> = { hospitalId, appointmentDate: today };
    if (session.user.role === "DOCTOR") {
      baseFilter.doctorUserId = session.payload.userId;
    } else {
      const doctorUserId = req.nextUrl.searchParams.get("doctorUserId")?.trim();
      if (doctorUserId) baseFilter.doctorUserId = doctorUserId;
    }

    await connectDb();

    // Compute today's date string for slot lookup
    const todayStr = (dateParam ? new Date(dateParam) : new Date()).toISOString().split("T")[0];
    const slotFilter: Record<string, unknown> = { hospitalId, date: todayStr };
    if (baseFilter.doctorUserId) slotFilter.doctorUserId = baseFilter.doctorUserId;

    const [totalToday, waiting, checkedIn, inConsultation, completed, cancelled, noShow, slots] =
      await Promise.all([
        Appointment.countDocuments(baseFilter),
        Appointment.countDocuments({ ...baseFilter, status: { $in: ["Scheduled", "Checked In"] } }),
        Appointment.countDocuments({ ...baseFilter, status: "Checked In" }),
        Appointment.countDocuments({ ...baseFilter, status: "In Consultation" }),
        Appointment.countDocuments({ ...baseFilter, status: "Completed" }),
        Appointment.countDocuments({ ...baseFilter, status: "Cancelled" }),
        Appointment.countDocuments({ ...baseFilter, status: "No Show" }),
        AppointmentSlot.find(slotFilter).select("slotId status bookedCount maxBookings"),
      ]);

    const todaySlotsTotal = slots.length;
    const todaySlotsBooked = slots.filter((s) => s.bookedCount > 0).length;
    const todaySlotsAvailable = slots.filter((s) => s.status === "Available" && s.bookedCount < s.maxBookings).length;
    const todaySlotsCompleted = slots.filter((s) => s.status === "Completed").length;

    return successResponse({
      totalToday,
      waiting,
      checkedIn,
      inConsultation,
      completed,
      cancelled,
      noShow,
      todaySlotsTotal,
      todaySlotsBooked,
      todaySlotsAvailable,
      todaySlotsCompleted,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
