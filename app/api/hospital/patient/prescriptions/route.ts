import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { doctorMapFor, patientListPagination, requirePatientAuth } from "@/lib/hospital-patient";
import Appointment from "@/models/Appointment";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const { page, limit, skip } = patientListPagination(req.nextUrl.searchParams);
    const filter = {
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      status: "Issued" as const,
    };
    await connectDb();
    const [prescriptions, total] = await Promise.all([
      Prescription.find(filter).sort({ issuedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
      Prescription.countDocuments(filter),
    ]);
    const [doctorById, appointments, sales] = await Promise.all([
      doctorMapFor(session.payload.hospitalId, prescriptions.map((prescription) => prescription.doctorUserId)),
      Appointment.find({
        hospitalId: session.payload.hospitalId,
        appointmentId: { $in: prescriptions.map((prescription) => prescription.appointmentId).filter(Boolean) },
      }).select("appointmentId appointmentDate appointmentTime type status reason"),
      PharmacySale.find({
        hospitalId: session.payload.hospitalId,
        prescriptionId: { $in: prescriptions.map((prescription) => prescription.prescriptionId) },
        saleStatus: "Completed",
      }).select("saleId prescriptionId saleStatus createdAt"),
    ]);
    const appointmentById = new Map(appointments.map((appointment) => [appointment.appointmentId, appointment]));
    const saleByPrescriptionId = new Map(sales.map((sale) => [sale.prescriptionId, sale]));

    return successResponse(
      serializeDoc(prescriptions.map((prescription) => ({
        prescriptionId: prescription.prescriptionId,
        status: prescription.status,
        consultationId: prescription.consultationId,
        appointmentId: prescription.appointmentId,
        doctor: doctorById.get(prescription.doctorUserId) ?? null,
        appointment: appointmentById.get(prescription.appointmentId) ?? null,
        medicines: prescription.medicines,
        testsRecommended: prescription.testsRecommended,
        generalInstructions: prescription.generalInstructions,
        followUpDate: prescription.followUpDate,
        issuedAt: prescription.issuedAt,
        createdAt: prescription.createdAt,
        sale: saleByPrescriptionId.get(prescription.prescriptionId) ?? null,
        dispensed: saleByPrescriptionId.has(prescription.prescriptionId),
        dispensingStatus: saleByPrescriptionId.has(prescription.prescriptionId) ? "Dispensed" : "Awaiting pharmacy",
      }))),
      "Patient prescriptions fetched",
      200,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
