import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPagination } from "@/lib/hospital-clinical";
import { requireValidHospital } from "@/lib/tenant";
import AppointmentSlot from "@/models/AppointmentSlot";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";

export async function GET(req: NextRequest) {
  try {
    const hospital = await requireValidHospital(req);
    const hospitalId = hospital.hospitalId;
    await connectDb();

    const date = req.nextUrl.searchParams.get("date")?.trim();
    if (!date) return errorResponse("date is required (YYYY-MM-DD)", 422);

    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = {
      hospitalId,
      date,
      status: "Available",
    };

    const doctorProfileId = req.nextUrl.searchParams.get("doctorProfileId")?.trim();
    const departmentId = req.nextUrl.searchParams.get("departmentId")?.trim();

    if (doctorProfileId) filter.doctorProfileId = doctorProfileId;
    if (departmentId) filter.departmentId = departmentId;

    const [slots, total] = await Promise.all([
      AppointmentSlot.find(filter).sort({ startTime: 1 }).skip(skip).limit(limit),
      AppointmentSlot.countDocuments(filter),
    ]);

    // Only return slots that still have seats available
    const availableSlots = slots.filter((s) => s.bookedCount < s.maxBookings);

    const doctorProfileIds = [
      ...new Set(availableSlots.map((s) => s.doctorProfileId).filter((id): id is string => Boolean(id))),
    ];
    const departmentIds = [
      ...new Set(availableSlots.map((s) => s.departmentId).filter((id): id is string => Boolean(id))),
    ];

    const [profiles, departments] = await Promise.all([
      HospitalDoctorPublicProfile.find({
        hospitalId,
        _id: { $in: doctorProfileIds },
        status: "Active",
      }).select("name specialization consultationFee photoUrl"),
      HospitalDepartment.find({ hospitalId, _id: { $in: departmentIds } }).select("name"),
    ]);

    const profileById = new Map(profiles.map((p) => [p._id.toString(), p]));
    const departmentById = new Map(departments.map((d) => [d._id.toString(), d]));

    const result = availableSlots.map((slot) => ({
      slotId: slot.slotId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes,
      availableSeats: slot.maxBookings - slot.bookedCount,
      room: slot.room,
      location: slot.location,
      status: slot.status,
      doctor: slot.doctorProfileId ? profileById.get(slot.doctorProfileId) ?? null : null,
      department: slot.departmentId ? departmentById.get(slot.departmentId) ?? null : null,
    }));

    return successResponse(serializeDoc(result), "Available slots fetched", 200, {
      page,
      limit,
      total: availableSlots.length,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
