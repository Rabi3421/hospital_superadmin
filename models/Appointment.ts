import { Document, Model, Schema, model, models } from "mongoose";

export const appointmentStatuses = [
  "Scheduled",
  "Checked In",
  "In Consultation",
  "Completed",
  "Cancelled",
  "No Show",
] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const appointmentSources = [
  "Walk In",
  "Phone",
  "Online",
  "Follow Up",
  "Patient Portal Slot",
  "Reception Slot",
  "Public Website",
] as const;

export type AppointmentSource = (typeof appointmentSources)[number];

export const triageStatuses = ["Pending", "In Triage", "Ready For Doctor", "Completed"] as const;
export type TriageStatus = (typeof triageStatuses)[number];

export const triagePriorities = ["Low", "Normal", "High", "Critical"] as const;
export type TriagePriority = (typeof triagePriorities)[number];

export interface AppointmentDocument extends Document {
  hospitalId: string;
  appointmentId: string;
  patientId: string;
  doctorUserId?: string;
  doctorProfileId?: string;
  departmentId?: string;
  slotId?: string;
  availabilityId?: string;
  appointmentDate: Date;
  appointmentTime?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  estimatedConsultationMinutes?: number;
  tokenNumber: string;
  queueNumber?: number;
  type: "OPD" | "Follow Up" | "Emergency" | "Online Request";
  status: AppointmentStatus;
  source: AppointmentSource;
  reason?: string;
  notes?: string;
  createdBy?: string;
  checkedInAt?: Date;
  consultationStartedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  triageStatus?: TriageStatus;
  triagePriority?: TriagePriority;
  triageNotes?: string;
  nurseAssignedId?: string;
  nurseReadyAt?: Date;
  latestVitalId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<AppointmentDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    appointmentId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    doctorUserId: { type: String, default: "", trim: true },
    doctorProfileId: { type: String, default: "", trim: true },
    departmentId: { type: String, default: "", trim: true },
    slotId: { type: String, default: "", trim: true },
    availabilityId: { type: String, default: "", trim: true },
    appointmentDate: { type: Date, required: true },
    appointmentTime: { type: String, default: "", trim: true },
    scheduledStartTime: { type: String, default: "", trim: true },
    scheduledEndTime: { type: String, default: "", trim: true },
    estimatedConsultationMinutes: { type: Number, default: 0, min: 0 },
    tokenNumber: { type: String, required: true, trim: true },
    queueNumber: { type: Number, default: 0 },
    type: { type: String, enum: ["OPD", "Follow Up", "Emergency", "Online Request"], default: "OPD", required: true },
    status: { type: String, enum: appointmentStatuses, default: "Scheduled", required: true },
    source: { type: String, enum: appointmentSources, default: "Walk In", required: true },
    reason: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "" },
    checkedInAt: { type: Date },
    consultationStartedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, default: "", trim: true },
    triageStatus: { type: String, enum: triageStatuses, default: "Pending" },
    triagePriority: { type: String, enum: triagePriorities, default: "Normal" },
    triageNotes: { type: String, default: "", trim: true },
    nurseAssignedId: { type: String, default: "", trim: true },
    nurseReadyAt: { type: Date },
    latestVitalId: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

appointmentSchema.index({ hospitalId: 1, appointmentId: 1 }, { unique: true });
appointmentSchema.index({ hospitalId: 1, appointmentDate: 1 });
appointmentSchema.index({ hospitalId: 1, doctorUserId: 1, appointmentDate: 1 });
appointmentSchema.index({ hospitalId: 1, tokenNumber: 1, appointmentDate: 1 }, { unique: true });

const Appointment =
  (models.Appointment as Model<AppointmentDocument>) ||
  model<AppointmentDocument>("Appointment", appointmentSchema);

export default Appointment;
