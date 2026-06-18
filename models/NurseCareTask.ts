import { Document, Model, Schema, model, models } from "mongoose";

export const nurseCareTaskTypes = [
  "Vitals",
  "Medication",
  "Observation",
  "Dressing",
  "Injection",
  "Procedure Support",
  "Follow Up",
  "Handover",
  "Other",
] as const;

export type NurseCareTaskType = (typeof nurseCareTaskTypes)[number];

export const nurseCareTaskPriorities = ["Low", "Normal", "High", "Critical"] as const;

export type NurseCareTaskPriority = (typeof nurseCareTaskPriorities)[number];

export const nurseCareTaskStatuses = ["Pending", "In Progress", "Completed", "Cancelled"] as const;

export type NurseCareTaskStatus = (typeof nurseCareTaskStatuses)[number];

export interface NurseCareTaskDocument extends Document {
  hospitalId: string;
  taskId: string;
  patientId: string;
  appointmentId?: string;
  assignedNurseId?: string;
  assignedBy?: string;
  taskType: NurseCareTaskType;
  title: string;
  description?: string;
  priority: NurseCareTaskPriority;
  dueAt?: Date;
  status: NurseCareTaskStatus;
  completedAt?: Date;
  completionNotes?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const nurseCareTaskSchema = new Schema<NurseCareTaskDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    taskId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    appointmentId: { type: String, default: "", trim: true },
    assignedNurseId: { type: String, default: "", trim: true },
    assignedBy: { type: String, default: "", trim: true },
    taskType: { type: String, enum: nurseCareTaskTypes, default: "Other", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    priority: { type: String, enum: nurseCareTaskPriorities, default: "Normal", required: true },
    dueAt: { type: Date },
    status: { type: String, enum: nurseCareTaskStatuses, default: "Pending", required: true },
    completedAt: { type: Date },
    completionNotes: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

nurseCareTaskSchema.index({ hospitalId: 1, taskId: 1 }, { unique: true });
nurseCareTaskSchema.index({ hospitalId: 1, assignedNurseId: 1, status: 1 });
nurseCareTaskSchema.index({ hospitalId: 1, patientId: 1 });
nurseCareTaskSchema.index({ hospitalId: 1, appointmentId: 1 });

const NurseCareTask =
  (models.NurseCareTask as Model<NurseCareTaskDocument>) ||
  model<NurseCareTaskDocument>("NurseCareTask", nurseCareTaskSchema);

export default NurseCareTask;
