import { Document, Model, Schema, model, models } from "mongoose";

export const notificationStatuses = ["QUEUED", "SENT", "FAILED", "SKIPPED"] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];

export const recipientTypes = [
  "PATIENT", "STAFF", "DOCTOR", "NURSE", "ADMIN", "DIRECTOR",
  "RECEPTIONIST", "ACCOUNTANT", "PHARMACIST", "LAB_TECHNICIAN",
] as const;
export type RecipientType = (typeof recipientTypes)[number];

export interface NotificationLogDocument extends Document {
  hospitalId: string;
  notificationId: string;
  eventType: string;
  channel: "WHATSAPP" | "SMS";
  recipientType: RecipientType;
  recipientName?: string;
  recipientPhone: string;
  recipientUserId?: string;
  patientId?: string;
  appointmentId?: string;
  prescriptionId?: string;
  labReportId?: string;
  billId?: string;
  paymentId?: string;
  pharmacySaleId?: string;
  templateId?: string;
  messagePreview: string;
  payload?: Record<string, unknown>;
  provider: string;
  providerMessageId?: string;
  status: NotificationStatus;
  failureReason?: string;
  retryCount: number;
  sentAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationLogSchema = new Schema<NotificationLogDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    notificationId: { type: String, required: true, trim: true },
    eventType: { type: String, required: true, trim: true },
    channel: { type: String, enum: ["WHATSAPP", "SMS"], required: true },
    recipientType: { type: String, enum: recipientTypes, default: "PATIENT" },
    recipientName: { type: String, default: "", trim: true },
    recipientPhone: { type: String, required: true, trim: true },
    recipientUserId: { type: String, default: "", trim: true },
    patientId: { type: String, default: "", trim: true },
    appointmentId: { type: String, default: "", trim: true },
    prescriptionId: { type: String, default: "", trim: true },
    labReportId: { type: String, default: "", trim: true },
    billId: { type: String, default: "", trim: true },
    paymentId: { type: String, default: "", trim: true },
    pharmacySaleId: { type: String, default: "", trim: true },
    templateId: { type: String, default: "", trim: true },
    messagePreview: { type: String, required: true, trim: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    provider: { type: String, required: true, trim: true },
    providerMessageId: { type: String, default: "", trim: true },
    status: { type: String, enum: notificationStatuses, default: "QUEUED", required: true },
    failureReason: { type: String, default: "", trim: true },
    retryCount: { type: Number, default: 0 },
    sentAt: { type: Date },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

notificationLogSchema.index({ hospitalId: 1, notificationId: 1 }, { unique: true });
notificationLogSchema.index({ hospitalId: 1, eventType: 1, createdAt: -1 });
notificationLogSchema.index({ hospitalId: 1, patientId: 1, createdAt: -1 });
notificationLogSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
notificationLogSchema.index({ hospitalId: 1, appointmentId: 1 });

const NotificationLog =
  (models.NotificationLog as Model<NotificationLogDocument>) ||
  model<NotificationLogDocument>("NotificationLog", notificationLogSchema);

export default NotificationLog;
