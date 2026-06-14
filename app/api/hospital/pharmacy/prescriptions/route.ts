import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor, endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";

function dateBetween(searchParams: URLSearchParams) {
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  if (dateFrom && dateTo) return { $gte: startOfDay(new Date(dateFrom)), $lte: endOfDay(new Date(dateTo)) };
  if (dateFrom) return { $gte: startOfDay(new Date(dateFrom)) };
  if (dateTo) return { $lte: endOfDay(new Date(dateTo)) };
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "pharmacy_prescription_queue_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId, status: "Issued", "medicines.0": { $exists: true } };
    ["patientId", "doctorUserId"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    await connectDb();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const matchingPatients = await Patient.find({ hospitalId, $or: [{ patientId: regex }, { name: regex }, { phone: regex }] }).select("patientId");
      filter.$or = [
        { prescriptionId: regex },
        { patientId: { $in: matchingPatients.map((patient) => patient.patientId) } },
        { consultationId: regex },
        { appointmentId: regex },
      ];
    }
    const createdAt = dateBetween(req.nextUrl.searchParams);
    const date = req.nextUrl.searchParams.get("date");
    if (date) filter.createdAt = dateRangeFor(date);
    else if (createdAt) filter.createdAt = createdAt;
    const prescriptions = await Prescription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Prescription.countDocuments(filter);
    const patientIds = prescriptions.map((prescription) => prescription.patientId);
    const doctorUserIds = prescriptions.map((prescription) => prescription.doctorUserId);
    const consultationIds = prescriptions.map((prescription) => prescription.consultationId);
    const appointmentIds = prescriptions.map((prescription) => prescription.appointmentId);
    const prescriptionIds = prescriptions.map((prescription) => prescription.prescriptionId);
    const [patients, doctors, doctorProfiles, consultations, appointments, sales] = await Promise.all([
      Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone email gender age bloodGroup allergies"),
      HospitalUser.find({ hospitalId, _id: { $in: doctorUserIds } }).select("name email phone role status"),
      HospitalDoctorPublicProfile.find({ hospitalId, userId: { $in: doctorUserIds } }).select("userId specialization qualification"),
      Consultation.find({ hospitalId, consultationId: { $in: consultationIds } }).select(
        "consultationId appointmentId status diagnosis chiefComplaint",
      ),
      Appointment.find({ hospitalId, appointmentId: { $in: appointmentIds } }).select(
        "appointmentId appointmentDate appointmentTime tokenNumber status departmentId",
      ),
      PharmacySale.find({ hospitalId, prescriptionId: { $in: prescriptionIds } }).select("prescriptionId saleId saleStatus grandTotal"),
    ]);
    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const doctorProfileById = new Map(doctorProfiles.map((profile) => [profile.userId, profile]));
    const doctorById = new Map(
      doctors.map((doctor) => {
        const userId = String(doctor._id);
        return [userId, { ...doctor.toObject(), userId, profile: doctorProfileById.get(userId) ?? null }];
      }),
    );
    const consultationById = new Map(consultations.map((consultation) => [consultation.consultationId, consultation]));
    const appointmentById = new Map(appointments.map((appointment) => [appointment.appointmentId, appointment]));
    const saleByPrescriptionId = new Map(sales.map((sale) => [sale.prescriptionId, sale]));
    const queue = prescriptions.map((prescription) => ({
      ...prescription.toObject(),
      patient: patientById.get(prescription.patientId) ?? null,
      doctor: doctorById.get(prescription.doctorUserId) ?? null,
      consultation: consultationById.get(prescription.consultationId) ?? null,
      appointment: appointmentById.get(prescription.appointmentId) ?? null,
      sale: saleByPrescriptionId.get(prescription.prescriptionId) ?? null,
      dispensed: saleByPrescriptionId.get(prescription.prescriptionId)?.saleStatus === "Completed",
    }));
    return successResponse(serializeDoc(queue), "Pharmacy prescription queue fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
