import PatientVitalRecord from "@/models/PatientVitalRecord";
import NursingNote from "@/models/NursingNote";
import NurseCareTask from "@/models/NurseCareTask";
import MedicationAdministrationRecord from "@/models/MedicationAdministrationRecord";

export async function generateVitalId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `VTL-${year}-`;
  const latest = await PatientVitalRecord.findOne({ hospitalId, vitalId: { $regex: `^${prefix}` } })
    .sort({ vitalId: -1 })
    .select("vitalId");
  const nextNumber = latest?.vitalId ? Number(latest.vitalId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateNursingNoteId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `NUR-NOTE-${year}-`;
  const latest = await NursingNote.findOne({ hospitalId, noteId: { $regex: `^${prefix}` } })
    .sort({ noteId: -1 })
    .select("noteId");
  const nextNumber = latest?.noteId ? Number(latest.noteId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateCareTaskId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `NCT-${year}-`;
  const latest = await NurseCareTask.findOne({ hospitalId, taskId: { $regex: `^${prefix}` } })
    .sort({ taskId: -1 })
    .select("taskId");
  const nextNumber = latest?.taskId ? Number(latest.taskId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateMedicationAdministrationId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `MAR-${year}-`;
  const latest = await MedicationAdministrationRecord.findOne({
    hospitalId,
    administrationId: { $regex: `^${prefix}` },
  })
    .sort({ administrationId: -1 })
    .select("administrationId");
  const nextNumber = latest?.administrationId ? Number(latest.administrationId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export function calculateBMI(weight: number, height: number): number {
  const heightInMeters = height / 100;
  return Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10;
}
