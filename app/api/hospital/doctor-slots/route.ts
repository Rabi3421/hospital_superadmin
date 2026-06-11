import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import AppointmentSlot from "@/models/AppointmentSlot";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalUser from "@/models/HospitalUser";

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
    const fromDate = req.nextUrl.searchParams.get("fromDate")?.trim();
    const toDate = req.nextUrl.searchParams.get("toDate")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const availabilityId = req.nextUrl.searchParams.get("availabilityId")?.trim();
    const departmentId = req.nextUrl.searchParams.get("departmentId")?.trim();
    const doctorProfileId = req.nextUrl.searchParams.get("doctorProfileId")?.trim();

    if (date) {
      filter.date = date;
    } else if (fromDate || toDate) {
      const dateFilter: Record<string, string> = {};
      if (fromDate) dateFilter.$gte = fromDate;
      if (toDate) dateFilter.$lte = toDate;
      filter.date = dateFilter;
    }

    if (status) filter.status = status;
    if (availabilityId) filter.availabilityId = availabilityId;
    if (departmentId) filter.departmentId = departmentId;
    if (doctorProfileId) filter.doctorProfileId = doctorProfileId;

    const [rawSlots, total] = await Promise.all([
      AppointmentSlot.find(filter).sort({ date: -1, startTime: 1 }).skip(skip).limit(limit),
      AppointmentSlot.countDocuments(filter),
    ]);

    const doctorIds = [...new Set(rawSlots.map((s) => s.doctorUserId).filter((id): id is string => Boolean(id)))];
    const deptIds = [...new Set(rawSlots.map((s) => s.departmentId).filter((id): id is string => Boolean(id)))];

    const [doctors, departments] = await Promise.all([
      doctorIds.length ? HospitalUser.find({ hospitalId, _id: { $in: doctorIds } }).select("name") : [],
      deptIds.length ? HospitalDepartment.find({ _id: { $in: deptIds } }).select("name") : [],
    ]);

    const doctorNameById = new Map(doctors.map((d) => [d._id.toString(), d.name]));
    const deptNameById = new Map(departments.map((d) => [d._id.toString(), d.name]));

    const slots = rawSlots.map((slot) => ({
      ...slot.toObject(),
      doctorName: slot.doctorUserId ? (doctorNameById.get(slot.doctorUserId) ?? "") : "",
      departmentName: slot.departmentId ? (deptNameById.get(slot.departmentId) ?? "") : "",
      availableSeats: Math.max(0, slot.maxBookings - slot.bookedCount),
    }));

    return successResponse(
      { slots: serializeDoc(slots), total },
      "Doctor slots fetched",
      200,
      { page, limit, totalPages: Math.ceil(total / limit) },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
