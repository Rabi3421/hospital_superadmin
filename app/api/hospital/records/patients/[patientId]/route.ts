import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import Consultation from "@/models/Consultation";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";

type RouteContext = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "clinical_records_view");
    const { patientId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const role = session.user.role;

    if (role === "PATIENT") {
      throw new Error("Forbidden: patients cannot access this endpoint");
    }

    await connectDb();

    const patient = await Patient.findOne({ hospitalId, patientId });
    if (!patient) return errorResponse("Patient not found for this hospital", 404);

    const appointmentFilter: Record<string, unknown> = { hospitalId, patientId };
    // Doctors see only own-assigned appointments for this patient
    if (role === "DOCTOR") {
      appointmentFilter.doctorUserId = session.payload.userId;
    }

    const [appointments, consultations, prescriptions, labOrders, labReports, bills, pharmacySales] =
      await Promise.all([
        Appointment.find(appointmentFilter).sort({ appointmentDate: -1 }),
        Consultation.find({ hospitalId, patientId, ...(role === "DOCTOR" ? { doctorUserId: session.payload.userId } : {}) }).sort({ createdAt: -1 }),
        Prescription.find({ hospitalId, patientId, ...(role === "DOCTOR" ? { doctorUserId: session.payload.userId } : {}) }).sort({ createdAt: -1 }),
        LabOrder.find({ hospitalId, patientId }).sort({ createdAt: -1 }),
        LabReport.find({ hospitalId, patientId, status: "Published" }).sort({ publishedAt: -1 }),
        Bill.find({ hospitalId, patientId }).sort({ createdAt: -1 }),
        PharmacySale.find({ hospitalId, patientId }).sort({ createdAt: -1 }),
      ]);

    return successResponse(
      serializeDoc({
        patient,
        appointments,
        consultations,
        prescriptions,
        labOrders,
        labReports,
        bills,
        pharmacySales,
      }),
      "Patient clinical records fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
