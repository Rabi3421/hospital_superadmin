import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import MedicationAdministrationRecord from "@/models/MedicationAdministrationRecord";
import NurseCareTask from "@/models/NurseCareTask";
import NursingNote from "@/models/NursingNote";
import Patient from "@/models/Patient";
import PatientVitalRecord from "@/models/PatientVitalRecord";
import Prescription from "@/models/Prescription";

type RouteContext = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "nurse_patient_records_view_assigned");
    const { patientId } = await context.params;
    const hospitalId = session.payload.hospitalId;
    const today = dateRangeFor(new Date());
    await connectDb();

    const patient = await Patient.findOne({ hospitalId, patientId }).select(
      "patientId name phone email gender age bloodGroup address status",
    );
    if (!patient) return errorResponse("Patient not found", 404);

    const [activeAppointments, latestVitals, latestNotes, latestTasks, latestMedications, latestPrescriptions] =
      await Promise.all([
        Appointment.find({
          hospitalId,
          patientId,
          appointmentDate: today,
          status: { $in: ["Scheduled", "Checked In", "In Consultation"] },
        })
          .sort({ createdAt: -1 })
          .select("appointmentId tokenNumber appointmentDate appointmentTime doctorUserId status triageStatus triagePriority nurseReadyAt"),
        PatientVitalRecord.find({ hospitalId, patientId })
          .sort({ recordedAt: -1 })
          .limit(5)
          .select("vitalId appointmentId temperature pulse bloodPressureSystolic bloodPressureDiastolic respiratoryRate oxygenSaturation weight height bmi bloodSugar painScore notes recordedAt status"),
        NursingNote.find({ hospitalId, patientId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("noteId appointmentId nurseUserId noteType priority title note createdAt status"),
        NurseCareTask.find({ hospitalId, patientId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("taskId appointmentId assignedNurseId taskType title priority dueAt status completedAt"),
        MedicationAdministrationRecord.find({ hospitalId, patientId })
          .sort({ administeredAt: -1 })
          .limit(5)
          .select("administrationId appointmentId medicineName dose route administeredAt administeredBy status"),
        Prescription.find({ hospitalId, patientId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("prescriptionId doctorUserId issuedAt status"),
      ]);

    return successResponse(
      serializeDoc({
        patient,
        activeAppointments,
        latestVitals,
        latestNotes,
        latestTasks,
        latestMedications,
        latestPrescriptions,
      }),
      "Patient summary fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
