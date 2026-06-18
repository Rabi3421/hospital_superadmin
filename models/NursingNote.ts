import { Document, Model, Schema, model, models } from "mongoose";

export const nursingNoteTypes = [
  "General",
  "Triage",
  "Observation",
  "Medication",
  "Procedure",
  "Handover",
  "Follow Up",
] as const;

export type NursingNoteType = (typeof nursingNoteTypes)[number];

export const nursingNotePriorities = ["Low", "Normal", "High", "Critical"] as const;

export type NursingNotePriority = (typeof nursingNotePriorities)[number];

export const nursingNoteStatuses = ["Active", "Edited", "Deleted"] as const;

export type NursingNoteStatus = (typeof nursingNoteStatuses)[number];

export interface NursingNoteDocument extends Document {
  hospitalId: string;
  noteId: string;
  patientId: string;
  appointmentId?: string;
  consultationId?: string;
  nurseUserId: string;
  noteType: NursingNoteType;
  priority: NursingNotePriority;
  title?: string;
  note: string;
  patientVisible: boolean;
  status: NursingNoteStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const nursingNoteSchema = new Schema<NursingNoteDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    noteId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    appointmentId: { type: String, default: "", trim: true },
    consultationId: { type: String, default: "", trim: true },
    nurseUserId: { type: String, required: true, trim: true },
    noteType: { type: String, enum: nursingNoteTypes, default: "General", required: true },
    priority: { type: String, enum: nursingNotePriorities, default: "Normal", required: true },
    title: { type: String, default: "", trim: true },
    note: { type: String, required: true, trim: true },
    patientVisible: { type: Boolean, default: false },
    status: { type: String, enum: nursingNoteStatuses, default: "Active", required: true },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

nursingNoteSchema.index({ hospitalId: 1, noteId: 1 }, { unique: true });
nursingNoteSchema.index({ hospitalId: 1, patientId: 1, createdAt: 1 });
nursingNoteSchema.index({ hospitalId: 1, appointmentId: 1 });
nursingNoteSchema.index({ hospitalId: 1, nurseUserId: 1 });

const NursingNote =
  (models.NursingNote as Model<NursingNoteDocument>) ||
  model<NursingNoteDocument>("NursingNote", nursingNoteSchema);

export default NursingNote;
