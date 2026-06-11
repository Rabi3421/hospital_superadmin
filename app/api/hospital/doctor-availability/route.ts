import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPagination, validateAppointmentRefs } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import DoctorAvailability from "@/models/DoctorAvailability";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

async function generateAvailabilityId(hospitalId: string) {
  const year = new Date().getFullYear();
  const prefix = `AVL-${year}-`;
  const latest = await DoctorAvailability.findOne({ hospitalId, availabilityId: { $regex: `^${prefix}` } })
    .sort({ availabilityId: -1 })
    .select("availabilityId");
  const nextNumber = latest?.availabilityId ? Number(latest.availabilityId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

const createSchema = z.object({
  doctorUserId: z.string().min(1),
  doctorProfileId: z.string().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime must be HH:mm"),
  slotDurationMinutes: z.number().int().min(5).default(30),
  breakStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  breakEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  maxPatientsPerSlot: z.number().int().min(1).default(1),
  location: z.string().optional(),
  room: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "doctor_availability_view");
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

    if (date) {
      filter.date = date;
    } else if (fromDate || toDate) {
      const dateFilter: Record<string, string> = {};
      if (fromDate) dateFilter.$gte = fromDate;
      if (toDate) dateFilter.$lte = toDate;
      filter.date = dateFilter;
    }

    if (status) filter.status = status;

    const [availabilities, total] = await Promise.all([
      DoctorAvailability.find(filter).sort({ date: -1, startTime: 1 }).skip(skip).limit(limit),
      DoctorAvailability.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(availabilities), "Doctor availabilities fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "doctor_availability_create");
    if (session.user.role === "DOCTOR") {
      throw new Error("Forbidden: doctors cannot create availability directly");
    }
    const hospitalId = session.payload.hospitalId;
    const body = createSchema.parse(await req.json());
    await connectDb();

    // Validate time ordering
    if (timeToMinutes(body.startTime) >= timeToMinutes(body.endTime)) {
      throw new Error("endTime must be after startTime");
    }
    if (body.breakStartTime && body.breakEndTime) {
      const bStart = timeToMinutes(body.breakStartTime);
      const bEnd = timeToMinutes(body.breakEndTime);
      const start = timeToMinutes(body.startTime);
      const end = timeToMinutes(body.endTime);
      if (bStart >= bEnd) throw new Error("breakEndTime must be after breakStartTime");
      if (bStart < start || bEnd > end) throw new Error("Break period must fall within start/end time");
    }

    // Validate date is not too far in the past (more than 1 day)
    const availDate = new Date(body.date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    if (availDate < yesterday) throw new Error("Cannot create availability for past dates");

    // Validate doctor ref
    await validateAppointmentRefs({
      hospitalId,
      doctorUserId: body.doctorUserId,
      departmentId: body.departmentId || undefined,
    });

    // Validate doctor profile if provided
    if (body.doctorProfileId) {
      const profile = await HospitalDoctorPublicProfile.findOne({
        hospitalId,
        _id: body.doctorProfileId,
        status: "Active",
      });
      if (!profile) throw new Error("Doctor profile not found or inactive for this hospital");
    }

    // Check for overlapping active availability for same doctor/date
    const overlapping = await DoctorAvailability.findOne({
      hospitalId,
      doctorUserId: body.doctorUserId,
      date: body.date,
      status: "Active",
      $or: [
        { startTime: { $lt: body.endTime }, endTime: { $gt: body.startTime } },
      ],
    });
    if (overlapping) {
      throw new Error("Doctor availability overlaps existing availability for this date");
    }

    const availability = await DoctorAvailability.create({
      ...body,
      hospitalId,
      availabilityId: await generateAvailabilityId(hospitalId),
      status: "Active",
      createdBy: session.payload.userId,
    });

    return successResponse({ availability: serializeDoc(availability) }, "Doctor availability created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
