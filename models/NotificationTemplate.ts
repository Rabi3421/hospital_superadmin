import { Document, Model, Schema, model, models } from "mongoose";

export const notificationEventTypes = [
  "APPOINTMENT_BOOKED",
  "APPOINTMENT_REQUESTED",
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_CHECKED_IN",
  "PATIENT_READY_FOR_DOCTOR",
  "DOCTOR_STARTED_CONSULTATION",
  "PRESCRIPTION_ISSUED",
  "LAB_REPORT_READY",
  "PAYMENT_RECEIVED",
  "BILL_GENERATED",
  "PHARMACY_SALE_COMPLETED",
  "FOLLOW_UP_REMINDER",
  "SLOT_REMINDER",
  "QUEUE_TURN_NEAR",
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];

export const templateChannels = ["WHATSAPP", "SMS"] as const;
export type TemplateChannel = (typeof templateChannels)[number];

export interface NotificationTemplateDocument extends Document {
  hospitalId: string;
  templateId: string;
  eventType: NotificationEventType;
  channel: TemplateChannel;
  name: string;
  language: string;
  providerTemplateName?: string;
  providerTemplateId?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  isSystemDefault: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationTemplateSchema = new Schema<NotificationTemplateDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    templateId: { type: String, required: true, trim: true },
    eventType: { type: String, enum: notificationEventTypes, required: true },
    channel: { type: String, enum: templateChannels, required: true },
    name: { type: String, required: true, trim: true },
    language: { type: String, default: "en", trim: true },
    providerTemplateName: { type: String, default: "", trim: true },
    providerTemplateId: { type: String, default: "", trim: true },
    body: { type: String, required: true },
    variables: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    isSystemDefault: { type: Boolean, default: false },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

notificationTemplateSchema.index({ hospitalId: 1, templateId: 1 }, { unique: true });
notificationTemplateSchema.index({ hospitalId: 1, eventType: 1, channel: 1, language: 1 });

const NotificationTemplate =
  (models.NotificationTemplate as Model<NotificationTemplateDocument>) ||
  model<NotificationTemplateDocument>("NotificationTemplate", notificationTemplateSchema);

export default NotificationTemplate;
