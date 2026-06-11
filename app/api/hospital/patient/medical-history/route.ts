import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requirePatientAuth } from "@/lib/hospital-patient";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import LabReport from "@/models/LabReport";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const hospitalId = session.payload.hospitalId;
    const patientId = session.patient.patientId;
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 20), 1), 50);
    await connectDb();
    const [appointments, prescriptions, labReports, bills, pharmacySales] = await Promise.all([
      Appointment.find({ hospitalId, patientId }).sort({ appointmentDate: -1, createdAt: -1 }).limit(limit),
      Prescription.find({ hospitalId, patientId, status: "Issued" }).sort({ issuedAt: -1, createdAt: -1 }).limit(limit),
      LabReport.find({ hospitalId, patientId, status: "Published" }).sort({ publishedAt: -1, createdAt: -1 }).limit(limit),
      Bill.find({ hospitalId, patientId, status: { $ne: "Draft" } }).sort({ createdAt: -1 }).limit(limit),
      PharmacySale.find({ hospitalId, patientId }).sort({ createdAt: -1 }).limit(limit),
    ]);

    return successResponse(
      serializeDoc({
        patient: session.patient,
        appointments,
        prescriptions,
        labReports,
        bills,
        pharmacySales,
      }),
      "Patient medical history fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
