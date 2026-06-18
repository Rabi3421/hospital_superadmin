import { Document, Model, Schema, model, models } from "mongoose";

export const notificationProviders = ["MOCK", "MSG91", "TWILIO", "GUPSHUP", "WHATSAPP_CLOUD", "CUSTOM"] as const;
export type NotificationProvider = (typeof notificationProviders)[number];

export const notificationChannels = ["WHATSAPP", "SMS", "BOTH", "NONE"] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

export interface HospitalNotificationSettingDocument extends Document {
  hospitalId: string;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  defaultChannel: NotificationChannel;
  provider: NotificationProvider;
  smsProvider: NotificationProvider;
  whatsappProvider: NotificationProvider;
  senderId?: string;
  whatsappPhoneNumberId?: string;
  maskedConfig?: Record<string, unknown>;
  encryptedConfig?: Record<string, unknown>;
  appointmentNotificationsEnabled: boolean;
  queueNotificationsEnabled: boolean;
  prescriptionNotificationsEnabled: boolean;
  labNotificationsEnabled: boolean;
  billingNotificationsEnabled: boolean;
  pharmacyNotificationsEnabled: boolean;
  followUpNotificationsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalNotificationSettingSchema = new Schema<HospitalNotificationSettingDocument>(
  {
    hospitalId: { type: String, required: true, unique: true, index: true },
    whatsappEnabled: { type: Boolean, default: false },
    smsEnabled: { type: Boolean, default: false },
    defaultChannel: { type: String, enum: notificationChannels, default: "NONE" },
    provider: { type: String, enum: notificationProviders, default: "MOCK" },
    smsProvider: { type: String, enum: notificationProviders, default: "MOCK" },
    whatsappProvider: { type: String, enum: notificationProviders, default: "MOCK" },
    senderId: { type: String, default: "", trim: true },
    whatsappPhoneNumberId: { type: String, default: "", trim: true },
    maskedConfig: { type: Schema.Types.Mixed, default: {} },
    encryptedConfig: { type: Schema.Types.Mixed, default: {} },
    appointmentNotificationsEnabled: { type: Boolean, default: true },
    queueNotificationsEnabled: { type: Boolean, default: true },
    prescriptionNotificationsEnabled: { type: Boolean, default: true },
    labNotificationsEnabled: { type: Boolean, default: true },
    billingNotificationsEnabled: { type: Boolean, default: true },
    pharmacyNotificationsEnabled: { type: Boolean, default: true },
    followUpNotificationsEnabled: { type: Boolean, default: true },
    quietHoursEnabled: { type: Boolean, default: false },
    quietHoursStart: { type: String, default: "" },
    quietHoursEnd: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

const HospitalNotificationSetting =
  (models.HospitalNotificationSetting as Model<HospitalNotificationSettingDocument>) ||
  model<HospitalNotificationSettingDocument>("HospitalNotificationSetting", hospitalNotificationSettingSchema);

export default HospitalNotificationSetting;
