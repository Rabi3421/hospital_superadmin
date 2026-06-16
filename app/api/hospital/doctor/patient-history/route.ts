import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { escapeRegex, getPagination } from "@/lib/hospital-clinical";
import { requireHospitalAuth } from "@/lib/hospital-auth";
import { resolveHospitalPermissions } from "@/lib/hospital-permissions";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import LabReport from "@/models/LabReport";
import Patient from "@/models/Patient";
import Prescription from "@/models/Prescription";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalAuth(req);
    if (!["DOCTOR", "HOSPITAL_ADMIN"].includes(session.user.role)) {
      throw new Error("Forbidden: doctor patient history is not available for this role");
    }
    const permissions = resolveHospitalPermissions(session.user.role, session.user.permissions);
    if (
      !permissions.includes("doctor_patient_history_view") &&
      !permissions.includes("patient_clinical_history_view") &&
      !permissions.includes("hospital:*")
    ) {
      throw new Error("Forbidden: permission required");
    }
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const filter: Record<string, unknown> = { hospitalId };

    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ patientId: regex }, { name: regex }, { phone: regex }, { email: regex }];
    }

    await connectDb();
    if (session.user.role === "DOCTOR") {
      const [appointmentPatientIds, consultationPatientIds] = await Promise.all([
        Appointment.distinct("patientId", { hospitalId, doctorUserId: session.payload.userId }),
        Consultation.distinct("patientId", { hospitalId, doctorUserId: session.payload.userId }),
      ]);
      filter.patientId = { $in: [...new Set([...appointmentPatientIds, ...consultationPatientIds])] };
    }
    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .select("patientId name phone email gender age dateOfBirth bloodGroup allergies status createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Patient.countDocuments(filter),
    ]);
    const patientIds = patients.map((patient) => patient.patientId);

    const [lastAppointments, consultationCounts, prescriptionCounts, labReportCounts] = await Promise.all([
      Appointment.aggregate<{ _id: string; lastAppointmentDate: Date }>([
        { $match: { hospitalId, patientId: { $in: patientIds } } },
        { $group: { _id: "$patientId", lastAppointmentDate: { $max: "$appointmentDate" } } },
      ]),
      Consultation.aggregate<{ _id: string; count: number }>([
        { $match: { hospitalId, patientId: { $in: patientIds } } },
        { $group: { _id: "$patientId", count: { $sum: 1 } } },
      ]),
      Prescription.aggregate<{ _id: string; count: number }>([
        { $match: { hospitalId, patientId: { $in: patientIds } } },
        { $group: { _id: "$patientId", count: { $sum: 1 } } },
      ]),
      LabReport.aggregate<{ _id: string; count: number }>([
        { $match: { hospitalId, patientId: { $in: patientIds } } },
        { $group: { _id: "$patientId", count: { $sum: 1 } } },
      ]),
    ]);
    const lastAppointmentByPatient = new Map(lastAppointments.map((item) => [item._id, item.lastAppointmentDate]));
    const consultationCountByPatient = new Map(consultationCounts.map((item) => [item._id, item.count]));
    const prescriptionCountByPatient = new Map(prescriptionCounts.map((item) => [item._id, item.count]));
    const labReportCountByPatient = new Map(labReportCounts.map((item) => [item._id, item.count]));
    const records = patients.map((patient) => ({
      ...patient.toObject(),
      lastVisitAt: lastAppointmentByPatient.get(patient.patientId) ?? null,
      lastAppointmentDate: lastAppointmentByPatient.get(patient.patientId) ?? null,
      totalConsultations: consultationCountByPatient.get(patient.patientId) ?? 0,
      totalPrescriptions: prescriptionCountByPatient.get(patient.patientId) ?? 0,
      totalLabReports: labReportCountByPatient.get(patient.patientId) ?? 0,
    }));
    const pagination = { page, limit, total, totalPages: Math.ceil(total / limit) };

    return successResponse(
      serializeDoc({ patients: records, pagination }),
      "Doctor patient history patients fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
