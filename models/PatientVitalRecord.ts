import { Document, Model, Schema, model, models } from "mongoose";

export const patientVitalRecordStatuses = ["Active", "Corrected", "Deleted"] as const;

export type PatientVitalRecordStatus = (typeof patientVitalRecordStatuses)[number];

export interface PatientVitalRecordDocument extends Document {
  hospitalId: string;
  vitalId: string;
  patientId: string;
  appointmentId?: string;
  consultationId?: string;
  doctorUserId?: string;
  nurseUserId: string;
  recordedAt: Date;
  temperature?: number;
  pulse?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  bloodSugar?: number;
  painScore?: number;
  notes?: string;
  status: PatientVitalRecordStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const patientVitalRecordSchema = new Schema<PatientVitalRecordDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    vitalId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    appointmentId: { type: String, default: "", trim: true },
    consultationId: { type: String, default: "", trim: true },
    doctorUserId: { type: String, default: "", trim: true },
    nurseUserId: { type: String, required: true, trim: true },
    recordedAt: { type: Date, required: true },
    temperature: { type: Number },
    pulse: { type: Number },
    bloodPressureSystolic: { type: Number },
    bloodPressureDiastolic: { type: Number },
    respiratoryRate: { type: Number },
    oxygenSaturation: { type: Number },
    weight: { type: Number },
    height: { type: Number },
    bmi: { type: Number },
    bloodSugar: { type: Number },
    painScore: { type: Number, min: 0, max: 10 },
    notes: { type: String, default: "", trim: true },
    status: { type: String, enum: patientVitalRecordStatuses, default: "Active", required: true },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

patientVitalRecordSchema.index({ hospitalId: 1, vitalId: 1 }, { unique: true });
patientVitalRecordSchema.index({ hospitalId: 1, patientId: 1, recordedAt: 1 });
patientVitalRecordSchema.index({ hospitalId: 1, appointmentId: 1 });
patientVitalRecordSchema.index({ hospitalId: 1, nurseUserId: 1, recordedAt: 1 });

const PatientVitalRecord =
  (models.PatientVitalRecord as Model<PatientVitalRecordDocument>) ||
  model<PatientVitalRecordDocument>("PatientVitalRecord", patientVitalRecordSchema);

export default PatientVitalRecord;
