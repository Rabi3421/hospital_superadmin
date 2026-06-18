import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import MedicationAdministrationRecord from "@/models/MedicationAdministrationRecord";
import NurseCareTask from "@/models/NurseCareTask";
import NursingNote from "@/models/NursingNote";
import Patient from "@/models/Patient";
import PatientVitalRecord from "@/models/PatientVitalRecord";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "nurse_dashboard_view");
    const hospitalId = session.payload.hospitalId;
    const today = dateRangeFor(new Date());
    await connectDb();

    const nurseFilter: Record<string, unknown> = { hospitalId };
    const appointmentNurseFilter: Record<string, unknown> = { hospitalId };
    if (session.user.role === "NURSE") {
      nurseFilter.nurseUserId = session.payload.userId;
      appointmentNurseFilter.nurseAssignedId = session.payload.userId;
    }

    const [
      todayAppointmentsCount,
      waitingForTriage,
      inTriage,
      readyForDoctor,
      criticalPriority,
      vitalsRecordedToday,
      nursingNotesToday,
      pendingCareTasks,
      completedCareTasksToday,
      medicationAdministrationsToday,
      recentVitals,
      recentNotes,
      pendingTasksList,
    ] = await Promise.all([
      Appointment.countDocuments({
        ...appointmentNurseFilter,
        appointmentDate: today,
        status: { $in: ["Scheduled", "Checked In", "In Consultation"] },
      }),
      Appointment.countDocuments({
        ...appointmentNurseFilter,
        appointmentDate: today,
        triageStatus: "Pending",
      } as Record<string, unknown>),
      Appointment.countDocuments({
        ...appointmentNurseFilter,
        appointmentDate: today,
        triageStatus: "In Triage",
      }),
      Appointment.countDocuments({
        ...appointmentNurseFilter,
        appointmentDate: today,
        triageStatus: "Ready For Doctor",
      }),
      Appointment.countDocuments({
        ...appointmentNurseFilter,
        appointmentDate: today,
        triagePriority: "Critical",
        status: { $in: ["Scheduled", "Checked In", "In Consultation"] },
      }),
      PatientVitalRecord.countDocuments({ ...nurseFilter, recordedAt: today }),
      NursingNote.countDocuments({ ...nurseFilter, createdAt: today }),
      NurseCareTask.countDocuments({
        hospitalId,
        ...(session.user.role === "NURSE" ? { assignedNurseId: session.payload.userId } : {}),
        status: "Pending",
      }),
      NurseCareTask.countDocuments({
        hospitalId,
        ...(session.user.role === "NURSE" ? { assignedNurseId: session.payload.userId } : {}),
        status: "Completed",
        completedAt: today,
      }),
      MedicationAdministrationRecord.countDocuments({
        hospitalId,
        ...(session.user.role === "NURSE" ? { administeredBy: session.payload.userId } : {}),
        administeredAt: today,
      }),
      PatientVitalRecord.find(nurseFilter)
        .sort({ recordedAt: -1 })
        .limit(10)
        .select("vitalId patientId appointmentId temperature pulse bloodPressureSystolic bloodPressureDiastolic oxygenSaturation painScore recordedAt status"),
      NursingNote.find(nurseFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .select("noteId patientId appointmentId noteType priority title createdAt status"),
      NurseCareTask.find({
        hospitalId,
        ...(session.user.role === "NURSE" ? { assignedNurseId: session.payload.userId } : {}),
        status: "Pending",
      })
        .sort({ dueAt: 1, createdAt: -1 })
        .limit(10)
        .select("taskId patientId appointmentId taskType title priority dueAt status"),
    ]);

    const allPatientIds = [
      ...new Set([
        ...recentVitals.map((v) => v.patientId),
        ...recentNotes.map((n) => n.patientId),
        ...pendingTasksList.map((t) => t.patientId),
      ]),
    ];
    const patients = await Patient.find({ hospitalId, patientId: { $in: allPatientIds } }).select("patientId name phone");
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));

    function enrichWithPatient<T extends { patientId: string }>(docs: T[]) {
      return docs.map((doc) => ({
        ...serializeDoc(doc),
        patient: patientMap.get(doc.patientId) ? serializeDoc(patientMap.get(doc.patientId)) : null,
      }));
    }

    return successResponse({
      todayAppointmentsCount,
      waitingForTriage,
      inTriage,
      readyForDoctor,
      criticalPriority,
      vitalsRecordedToday,
      nursingNotesToday,
      pendingCareTasks,
      completedCareTasksToday,
      medicationAdministrationsToday,
      recentVitals: enrichWithPatient(recentVitals),
      recentNotes: enrichWithPatient(recentNotes),
      pendingTasksList: enrichWithPatient(pendingTasksList),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
