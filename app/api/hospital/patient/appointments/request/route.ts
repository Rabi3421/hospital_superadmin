import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requirePatientAuth } from "@/lib/hospital-patient";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import HospitalUser from "@/models/HospitalUser";

const appointmentRequestSchema = z.object({
  departmentId: z.string().optional().or(z.literal("")),
  doctorUserId: z.string().optional().or(z.literal("")),
  doctorProfileId: z.string().optional().or(z.literal("")),
  preferredDate: z.coerce.date(),
  preferredTime: z.string().optional().or(z.literal("")),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((body, ctx) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (body.preferredDate < today) {
    ctx.addIssue({ code: "custom", message: "Preferred date cannot be in the past", path: ["preferredDate"] });
  }
});

export async function POST(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const body = appointmentRequestSchema.parse(await req.json());
    await connectDb();
    if (session.patient.status !== "Active") {
      return errorResponse("Patient profile is inactive", 403);
    }
    if (!session.patient.email?.trim() && !session.patient.phone?.trim()) {
      return errorResponse("Add an email or phone number before requesting an appointment", 422);
    }

    const [department, doctorUser, doctorProfile] = await Promise.all([
      body.departmentId
        ? HospitalDepartment.findOne({ _id: body.departmentId, hospitalId: session.payload.hospitalId, status: "Active" }).select(
            "name description icon status",
          )
        : null,
      body.doctorUserId
        ? HospitalUser.findOne({
            _id: body.doctorUserId,
            hospitalId: session.payload.hospitalId,
            role: "DOCTOR",
            status: "Active",
          }).select("name email phone role status")
        : null,
      body.doctorProfileId
        ? HospitalDoctorPublicProfile.findOne({
            _id: body.doctorProfileId,
            hospitalId: session.payload.hospitalId,
            status: "Active",
          }).select("userId name departmentId specialization qualification experienceYears consultationFee photoUrl status")
        : null,
    ]);
    if (body.departmentId && !department) return errorResponse("Department not found", 404);
    if (body.doctorUserId && !doctorUser) return errorResponse("Doctor user not found", 404);
    if (body.doctorProfileId && !doctorProfile) return errorResponse("Doctor profile not found", 404);

    const mappedDoctorUserId = body.doctorUserId || doctorProfile?.userId || "";
    if (mappedDoctorUserId && !Types.ObjectId.isValid(mappedDoctorUserId)) {
      return errorResponse("Doctor user reference is invalid", 422);
    }

    const request = await HospitalAppointmentRequest.create({
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      userId: session.payload.userId,
      patientName: session.patient.name,
      phone: session.patient.phone,
      email: session.patient.email,
      departmentId: body.departmentId ?? "",
      doctorId: body.doctorProfileId || mappedDoctorUserId,
      doctorUserId: mappedDoctorUserId,
      doctorProfileId: body.doctorProfileId ?? "",
      preferredDate: body.preferredDate,
      preferredTime: body.preferredTime ?? "",
      message: body.reason ?? "",
      notes: body.notes ?? "",
      source: "Patient Portal",
      status: "New",
    });
    return successResponse(
      serializeDoc({
        request: {
          requestId: request._id,
          status: request.status,
          preferredDate: request.preferredDate,
          preferredTime: request.preferredTime,
          department,
          doctor: doctorProfile ?? doctorUser,
        },
      }),
      "Appointment request submitted successfully",
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
