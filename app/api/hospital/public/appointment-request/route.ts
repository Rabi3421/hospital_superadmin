import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPublicWebsiteAccess } from "@/lib/public-website";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";

const appointmentSchema = z.object({
  patientName: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  phone: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  departmentId: z.string().optional(),
  doctorId: z.string().optional(),
  doctorUserId: z.string().optional(),
  doctorProfileId: z.string().optional(),
  preferredDate: z.coerce.date(),
  preferredTime: z.string().min(1).optional().or(z.literal("")),
  reason: z.string().optional(),
  message: z.string().optional(),
}).superRefine((body, ctx) => {
  if (!body.patientName && !body.name) {
    ctx.addIssue({ code: "custom", message: "Patient name is required", path: ["patientName"] });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (body.preferredDate < today) {
    ctx.addIssue({ code: "custom", message: "Preferred date cannot be in the past", path: ["preferredDate"] });
  }
});

export async function POST(req: NextRequest) {
  try {
    const { hospital, response } = await getPublicWebsiteAccess(req);
    if (response) return response;

    const body = appointmentSchema.parse(await req.json());
    await connectDb();
    if (body.departmentId) {
      const department = await HospitalDepartment.findOne({
        _id: body.departmentId,
        hospitalId: hospital.hospitalId,
        status: "Active",
      });
      if (!department) return errorResponse("Department not found", 404);
    }

    const doctorRef = body.doctorProfileId || body.doctorUserId || body.doctorId || "";
    if (doctorRef) {
      const doctorFilter: Record<string, unknown> = {
        hospitalId: hospital.hospitalId,
        status: "Active",
        $or: [{ userId: doctorRef }],
      };
      if (Types.ObjectId.isValid(doctorRef)) {
        (doctorFilter.$or as Record<string, unknown>[]).push({ _id: doctorRef });
      }
      const doctor = await HospitalDoctorPublicProfile.findOne(doctorFilter);
      if (!doctor) return errorResponse("Doctor profile not found", 404);
    }

    const appointment = await HospitalAppointmentRequest.create({
      hospitalId: hospital.hospitalId,
      patientName: body.patientName ?? body.name,
      phone: body.phone,
      email: body.email ?? "",
      departmentId: body.departmentId ?? "",
      doctorId: doctorRef,
      doctorUserId: body.doctorUserId ?? "",
      doctorProfileId: body.doctorProfileId ?? "",
      preferredDate: body.preferredDate,
      preferredTime: body.preferredTime ?? "",
      message: body.message ?? body.reason ?? "",
      source: "Public Website",
      status: "New",
    });
    return successResponse(serializeDoc(appointment), "Appointment request submitted", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
