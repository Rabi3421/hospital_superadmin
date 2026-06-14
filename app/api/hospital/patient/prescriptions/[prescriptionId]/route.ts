import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { doctorMapFor, requirePatientAuth } from "@/lib/hospital-patient";
import Appointment from "@/models/Appointment";
import Hospital from "@/models/Hospital";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";

type RouteContext = { params: Promise<{ prescriptionId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requirePatientAuth(req);
    const { prescriptionId } = await context.params;
    await connectDb();
    const prescription = await Prescription.findOne({
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      prescriptionId,
      status: "Issued",
    });
    if (!prescription) return errorResponse("Prescription not found", 404);
    const [doctorById, appointment, patient, hospital, sale] = await Promise.all([
      doctorMapFor(session.payload.hospitalId, [prescription.doctorUserId]),
      Appointment.findOne({ hospitalId: session.payload.hospitalId, appointmentId: prescription.appointmentId }).select(
        "appointmentId appointmentDate appointmentTime type status reason",
      ),
      Patient.findOne({ hospitalId: session.payload.hospitalId, patientId: prescription.patientId }).select(
        "patientId name phone email gender age bloodGroup allergies",
      ),
      Hospital.findOne({ hospitalId: session.payload.hospitalId }).select(
        "hospitalId name address city state pincode ownerPhone logoUrl",
      ),
      PharmacySale.findOne({
        hospitalId: session.payload.hospitalId,
        prescriptionId,
        saleStatus: "Completed",
      }).select("saleId prescriptionId saleStatus createdAt"),
    ]);

    return successResponse(
      serializeDoc({
        prescriptionId: prescription.prescriptionId,
        consultationId: prescription.consultationId,
        appointmentId: prescription.appointmentId,
        doctor: doctorById.get(prescription.doctorUserId) ?? null,
        patient,
        hospital,
        sale,
        dispensed: Boolean(sale),
        consultation: { consultationId: prescription.consultationId },
        appointment,
        medicines: prescription.medicines,
        testsRecommended: prescription.testsRecommended,
        generalInstructions: prescription.generalInstructions,
        followUpDate: prescription.followUpDate,
        issuedAt: prescription.issuedAt,
        createdAt: prescription.createdAt,
      }),
      "Patient prescription fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
