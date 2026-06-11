import Appointment, { type AppointmentDocument } from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";
import Prescription from "@/models/Prescription";

export const patientEditableFields = [
  "name",
  "phone",
  "email",
  "gender",
  "dateOfBirth",
  "age",
  "bloodGroup",
  "address",
  "city",
  "state",
  "pincode",
  "emergencyContactName",
  "emergencyContactPhone",
  "medicalHistory",
  "allergies",
  "currentMedications",
  "status",
] as const;

export const appointmentEditableFields = [
  "patientId",
  "doctorUserId",
  "departmentId",
  "appointmentDate",
  "appointmentTime",
  "type",
  "source",
  "reason",
  "notes",
] as const;

export const consultationEditableFields = [
  "chiefComplaint",
  "historyOfPresentIllness",
  "symptoms",
  "vitals",
  "examinationFindings",
  "pastMedicalHistory",
  "pastSurgicalHistory",
  "familyHistory",
  "socialHistory",
  "allergyReview",
  "medicationReview",
  "diagnosis",
  "differentialDiagnosis",
  "clinicalNotes",
  "proceduresPerformed",
  "advice",
  "privateNotes",
  "disposition",
  "followUpDate",
] as const;

export const prescriptionEditableFields = [
  "medicines",
  "testsRecommended",
  "generalInstructions",
  "followUpDate",
] as const;

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getPagination(searchParams: URLSearchParams) {
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 20), 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

export function pickDefined<T extends readonly string[]>(body: Record<string, unknown>, fields: T) {
  return fields.reduce<Record<string, unknown>>((updates, field) => {
    if (body[field] !== undefined) updates[field] = body[field];
    return updates;
  }, {});
}

export function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function dateRangeFor(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return { $gte: startOfDay(date), $lte: endOfDay(date) };
}

export async function generatePatientId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `PAT-${year}-`;
  const latest = await Patient.findOne({ hospitalId, patientId: { $regex: `^${prefix}` } })
    .sort({ patientId: -1 })
    .select("patientId");
  const nextNumber = latest?.patientId ? Number(latest.patientId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateAppointmentId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `APT-${year}-`;
  const latest = await Appointment.findOne({ hospitalId, appointmentId: { $regex: `^${prefix}` } })
    .sort({ appointmentId: -1 })
    .select("appointmentId");
  const nextNumber = latest?.appointmentId ? Number(latest.appointmentId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateConsultationId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `CON-${year}-`;
  const latest = await Consultation.findOne({ hospitalId, consultationId: { $regex: `^${prefix}` } })
    .sort({ consultationId: -1 })
    .select("consultationId");
  const nextNumber = latest?.consultationId ? Number(latest.consultationId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generatePrescriptionId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `RX-${year}-`;
  const latest = await Prescription.findOne({ hospitalId, prescriptionId: { $regex: `^${prefix}` } })
    .sort({ prescriptionId: -1 })
    .select("prescriptionId");
  const nextNumber = latest?.prescriptionId ? Number(latest.prescriptionId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateTokenNumber(hospitalId: string, appointmentDate: Date) {
  const latest = await Appointment.findOne({
    hospitalId,
    appointmentDate: dateRangeFor(appointmentDate),
    tokenNumber: { $regex: "^OPD-" },
  })
    .sort({ tokenNumber: -1 })
    .select("tokenNumber");
  const nextNumber = latest?.tokenNumber ? Number(latest.tokenNumber.replace("OPD-", "")) + 1 : 1;
  return `OPD-${String(nextNumber || 1).padStart(3, "0")}`;
}

export async function validateAppointmentRefs({
  hospitalId,
  patientId,
  doctorUserId,
  departmentId,
}: {
  hospitalId: string;
  patientId?: string;
  doctorUserId?: string;
  departmentId?: string;
}) {
  if (patientId) {
    const patient = await Patient.findOne({ hospitalId, patientId });
    if (!patient) throw new Error("Patient not found for this hospital");
  }

  if (doctorUserId) {
    const doctor = await HospitalUser.findOne({
      _id: doctorUserId,
      hospitalId,
      role: "DOCTOR",
      status: "Active",
    });
    if (!doctor) throw new Error("Doctor user not found for this hospital");
  }

  if (departmentId) {
    const department = await HospitalDepartment.findOne({ _id: departmentId, hospitalId });
    if (!department) throw new Error("Department not found for this hospital");
  }
}

export function assertDoctorOwnsRecord(role: string, currentUserId: string, doctorUserId: string) {
  if (role === "DOCTOR" && doctorUserId !== currentUserId) {
    throw new Error("Forbidden: doctors can only access their own clinical records");
  }
}

export async function loadAppointmentForHospital(hospitalId: string, appointmentId: string) {
  return Appointment.findOne({ hospitalId, appointmentId });
}

export function assertTransition(
  appointment: AppointmentDocument,
  allowedStatuses: string[],
  nextStatus: AppointmentDocument["status"],
) {
  if (!allowedStatuses.includes(appointment.status)) {
    throw new Error(`Cannot move appointment from ${appointment.status} to ${nextStatus}`);
  }
}
