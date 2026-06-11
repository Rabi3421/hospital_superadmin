import { NextRequest } from "next/server";
import { dateRangeFor, getPagination } from "@/lib/hospital-clinical";
import { requireHospitalAuth, type HospitalAuthSession } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import HospitalUser from "@/models/HospitalUser";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import Patient, { type PatientDocument } from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";

export type PatientAuthSession = HospitalAuthSession & {
  patient: PatientDocument;
};

export const patientProfileSelect =
  "patientId name phone email profileCompleted profileCompletedAt gender dateOfBirth age bloodGroup address city state pincode emergencyContactName emergencyContactPhone medicalHistory allergies currentMedications status createdAt updatedAt";

export function patientSummary(patient: PatientDocument | null | undefined) {
  if (!patient) return null;
  return {
    patientId: patient.patientId,
    name: patient.name,
    phone: patient.phone ?? null,
    email: patient.email ?? null,
    profileCompleted: patient.profileCompleted,
    profileCompletedAt: patient.profileCompletedAt,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    age: patient.age,
    status: patient.status,
  };
}

export async function getLinkedPatientForUser(session: HospitalAuthSession) {
  const linkedPatientId = session.user.patientId?.trim();
  if (!linkedPatientId) return null;
  return Patient.findOne({
    hospitalId: session.payload.hospitalId,
    patientId: linkedPatientId,
    status: "Active",
  });
}

export async function requirePatientAuth(req: NextRequest): Promise<PatientAuthSession> {
  const session = await requireHospitalAuth(req);
  if (session.user.role !== "PATIENT") {
    throw new Error("Forbidden: patient role required");
  }

  const patient = await getLinkedPatientForUser(session);
  if (!patient) {
    throw new Error("Forbidden: patient profile setup required");
  }

  return { ...session, patient };
}

export async function buildPatientSetupState(session: HospitalAuthSession) {
  if (session.user.role !== "PATIENT") return {};
  const patient = await getLinkedPatientForUser(session);
  return {
    setupRequired: !patient,
    patient: patientSummary(patient),
  };
}

export function patientListPagination(searchParams: URLSearchParams) {
  return getPagination(searchParams);
}

export function applyPatientDateFilters(filter: Record<string, unknown>, searchParams: URLSearchParams) {
  const date = searchParams.get("date")?.trim();
  const fromDate = searchParams.get("fromDate")?.trim();
  const toDate = searchParams.get("toDate")?.trim();

  if (date) {
    filter.createdAt = dateRangeFor(date);
    return;
  }

  if (fromDate || toDate) {
    const createdAt: Record<string, Date> = {};
    if (fromDate) {
      const value = new Date(fromDate);
      value.setHours(0, 0, 0, 0);
      createdAt.$gte = value;
    }
    if (toDate) {
      const value = new Date(toDate);
      value.setHours(23, 59, 59, 999);
      createdAt.$lte = value;
    }
    filter.createdAt = createdAt;
  }
}

export function applyAppointmentDateFilters(filter: Record<string, unknown>, searchParams: URLSearchParams) {
  const date = searchParams.get("date")?.trim();
  const fromDate = searchParams.get("fromDate")?.trim();
  const toDate = searchParams.get("toDate")?.trim();

  if (date) {
    filter.appointmentDate = dateRangeFor(date);
    return;
  }

  if (fromDate || toDate) {
    const appointmentDate: Record<string, Date> = {};
    if (fromDate) {
      const value = new Date(fromDate);
      value.setHours(0, 0, 0, 0);
      appointmentDate.$gte = value;
    }
    if (toDate) {
      const value = new Date(toDate);
      value.setHours(23, 59, 59, 999);
      appointmentDate.$lte = value;
    }
    filter.appointmentDate = appointmentDate;
  }
}

export async function doctorMapFor(hospitalId: string, doctorUserIds: string[]) {
  const ids = [...new Set(doctorUserIds.filter(Boolean))];
  if (!ids.length) return new Map<string, unknown>();
  const doctors = await HospitalUser.find({ hospitalId, _id: { $in: ids }, role: "DOCTOR" }).select(
    "name email phone role status",
  );
  return new Map(doctors.map((doctor) => [doctor._id.toString(), doctor]));
}

export async function buildPatientDashboard(session: PatientAuthSession) {
  const hospitalId = session.payload.hospitalId;
  const patientId = session.patient.patientId;
  const now = new Date();

  const [
    upcomingAppointmentsCount,
    pastAppointmentsCount,
    activePrescriptionsCount,
    latestPrescription,
    pendingLabReportsCount,
    publishedLabReportsCount,
    unpaidBills,
    recentAppointments,
    recentPrescriptions,
    recentLabReports,
    recentBills,
  ] = await Promise.all([
    Appointment.countDocuments({ hospitalId, patientId, appointmentDate: { $gte: now }, status: { $ne: "Cancelled" } }),
    Appointment.countDocuments({ hospitalId, patientId, appointmentDate: { $lt: now } }),
    Prescription.countDocuments({ hospitalId, patientId, status: "Issued" }),
    Prescription.findOne({ hospitalId, patientId, status: "Issued" }).sort({ issuedAt: -1, createdAt: -1 }),
    LabOrder.countDocuments({ hospitalId, patientId, status: { $in: ["Ordered", "Sample Collected", "Processing", "Ready"] } }),
    LabReport.countDocuments({ hospitalId, patientId, status: "Published" }),
    Bill.find({ hospitalId, patientId, status: { $in: ["Unpaid", "Partially Paid"] } }).select("dueAmount"),
    Appointment.find({ hospitalId, patientId }).sort({ appointmentDate: -1, createdAt: -1 }).limit(5),
    Prescription.find({ hospitalId, patientId, status: "Issued" }).sort({ issuedAt: -1, createdAt: -1 }).limit(5),
    LabReport.find({ hospitalId, patientId, status: "Published" }).sort({ publishedAt: -1, createdAt: -1 }).limit(5),
    Bill.find({ hospitalId, patientId, status: { $ne: "Cancelled" } }).sort({ createdAt: -1 }).limit(5),
  ]);

  return {
    patient: patientSummary(session.patient),
    upcomingAppointmentsCount,
    pastAppointmentsCount,
    activePrescriptionsCount,
    latestPrescription,
    pendingLabReportsCount,
    publishedLabReportsCount,
    unpaidBillsCount: unpaidBills.length,
    totalDueAmount: unpaidBills.reduce((sum, bill) => sum + bill.dueAmount, 0),
    recentAppointments,
    recentPrescriptions,
    recentLabReports,
    recentBills,
    recentPharmacySales: await PharmacySale.find({ hospitalId, patientId }).sort({ createdAt: -1 }).limit(5),
  };
}
