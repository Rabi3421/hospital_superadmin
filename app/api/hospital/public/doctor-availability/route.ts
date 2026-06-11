import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPagination } from "@/lib/hospital-clinical";
import { requireValidHospital } from "@/lib/tenant";
import DoctorAvailability from "@/models/DoctorAvailability";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";

export async function GET(req: NextRequest) {
  try {
    const hospital = await requireValidHospital(req);
    const hospitalId = hospital.hospitalId;
    await connectDb();

    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId, status: "Active" };

    const date = req.nextUrl.searchParams.get("date")?.trim();
    const fromDate = req.nextUrl.searchParams.get("fromDate")?.trim();
    const toDate = req.nextUrl.searchParams.get("toDate")?.trim();
    const doctorUserId = req.nextUrl.searchParams.get("doctorUserId")?.trim();
    const doctorProfileId = req.nextUrl.searchParams.get("doctorProfileId")?.trim();
    const departmentId = req.nextUrl.searchParams.get("departmentId")?.trim();

    if (date) {
      filter.date = date;
    } else if (fromDate || toDate) {
      const dateFilter: Record<string, string> = {};
      if (fromDate) dateFilter.$gte = fromDate;
      if (toDate) dateFilter.$lte = toDate;
      filter.date = dateFilter;
    }

    if (doctorUserId) filter.doctorUserId = doctorUserId;
    if (doctorProfileId) filter.doctorProfileId = doctorProfileId;
    if (departmentId) filter.departmentId = departmentId;

    const [availabilities, total] = await Promise.all([
      DoctorAvailability.find(filter).sort({ date: 1, startTime: 1 }).skip(skip).limit(limit),
      DoctorAvailability.countDocuments(filter),
    ]);

    // Enrich with safe public doctor profile info
    const doctorProfileIds = [
      ...new Set(availabilities.map((a) => a.doctorProfileId).filter((id): id is string => Boolean(id))),
    ];
    const departmentIds = [
      ...new Set(availabilities.map((a) => a.departmentId).filter((id): id is string => Boolean(id))),
    ];

    const [profiles, departments] = await Promise.all([
      HospitalDoctorPublicProfile.find({
        hospitalId,
        _id: { $in: doctorProfileIds },
        status: "Active",
      }).select("name specialization qualification consultationFee photoUrl departmentId"),
      HospitalDepartment.find({ hospitalId, _id: { $in: departmentIds } }).select("name"),
    ]);

    const profileById = new Map(profiles.map((p) => [p._id.toString(), p]));
    const departmentById = new Map(departments.map((d) => [d._id.toString(), d]));

    const result = availabilities.map((avail) => ({
      availabilityId: avail.availabilityId,
      date: avail.date,
      startTime: avail.startTime,
      endTime: avail.endTime,
      slotDurationMinutes: avail.slotDurationMinutes,
      breakStartTime: avail.breakStartTime,
      breakEndTime: avail.breakEndTime,
      location: avail.location,
      room: avail.room,
      doctor: avail.doctorProfileId ? profileById.get(avail.doctorProfileId) ?? null : null,
      department: avail.departmentId ? departmentById.get(avail.departmentId) ?? null : null,
    }));

    return successResponse(serializeDoc(result), "Doctor availability fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
