import { Document, Model, Schema, model, models } from "mongoose";

export interface ConsultationVitals {
  temperature?: string;
  bloodPressure?: string;
  pulse?: string;
  spo2?: string;
  weight?: string;
  height?: string;
  bloodSugar?: string;
}

export interface ConsultationDocument extends Document {
  hospitalId: string;
  consultationId: string;
  appointmentId: string;
  patientId: string;
  doctorUserId: string;
  departmentId?: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  symptoms: string[];
  vitals: ConsultationVitals;
  examinationFindings?: string;
  pastMedicalHistory?: string;
  pastSurgicalHistory?: string;
  familyHistory?: string;
  socialHistory?: string;
  allergyReview?: string;
  medicationReview?: string;
  diagnosis?: string;
  differentialDiagnosis?: string;
  clinicalNotes?: string;
  proceduresPerformed?: string;
  advice?: string;
  privateNotes?: string;
  disposition?: "Home" | "Admit" | "Emergency Referral" | "Specialist Referral" | "Observation";
  followUpDate?: Date;
  status: "Draft" | "Completed" | "Cancelled";
  createdBy?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const vitalsSchema = new Schema<ConsultationVitals>(
  {
    temperature: { type: String, default: "", trim: true },
    bloodPressure: { type: String, default: "", trim: true },
    pulse: { type: String, default: "", trim: true },
    spo2: { type: String, default: "", trim: true },
    weight: { type: String, default: "", trim: true },
    height: { type: String, default: "", trim: true },
    bloodSugar: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const consultationSchema = new Schema<ConsultationDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    consultationId: { type: String, required: true, trim: true },
    appointmentId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    doctorUserId: { type: String, required: true, trim: true },
    departmentId: { type: String, default: "", trim: true },
    chiefComplaint: { type: String, default: "", trim: true },
    historyOfPresentIllness: { type: String, default: "", trim: true },
    symptoms: [{ type: String, trim: true }],
    vitals: { type: vitalsSchema, default: () => ({}) },
    examinationFindings: { type: String, default: "", trim: true },
    pastMedicalHistory: { type: String, default: "", trim: true },
    pastSurgicalHistory: { type: String, default: "", trim: true },
    familyHistory: { type: String, default: "", trim: true },
    socialHistory: { type: String, default: "", trim: true },
    allergyReview: { type: String, default: "", trim: true },
    medicationReview: { type: String, default: "", trim: true },
    diagnosis: { type: String, default: "", trim: true },
    differentialDiagnosis: { type: String, default: "", trim: true },
    clinicalNotes: { type: String, default: "", trim: true },
    proceduresPerformed: { type: String, default: "", trim: true },
    advice: { type: String, default: "", trim: true },
    privateNotes: { type: String, default: "", trim: true },
    disposition: {
      type: String,
      enum: ["Home", "Admit", "Emergency Referral", "Specialist Referral", "Observation"],
      default: "Home",
    },
    followUpDate: { type: Date },
    status: { type: String, enum: ["Draft", "Completed", "Cancelled"], default: "Draft", required: true },
    createdBy: { type: String, default: "" },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

consultationSchema.index({ hospitalId: 1, consultationId: 1 }, { unique: true });
consultationSchema.index({ hospitalId: 1, appointmentId: 1 }, { unique: true });
consultationSchema.index({ hospitalId: 1, patientId: 1 });
consultationSchema.index({ hospitalId: 1, doctorUserId: 1 });
consultationSchema.index({ hospitalId: 1, createdAt: 1 });

const Consultation =
  (models.Consultation as Model<ConsultationDocument>) ||
  model<ConsultationDocument>("Consultation", consultationSchema);

export default Consultation;
