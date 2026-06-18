import { Document, Model, Schema, model, models } from "mongoose";

export interface NotificationPreferenceDocument extends Document {
  hospitalId: string;
  patientId?: string;
  userId?: string;
  phone: string;
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  appointmentUpdates: boolean;
  labUpdates: boolean;
  billingUpdates: boolean;
  prescriptionUpdates: boolean;
  marketingOptIn: boolean;
  updatedAt: Date;
  createdAt: Date;
}

const notificationPreferenceSchema = new Schema<NotificationPreferenceDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    patientId: { type: String, default: "", trim: true },
    userId: { type: String, default: "", trim: true },
    phone: { type: String, required: true, trim: true },
    whatsappOptIn: { type: Boolean, default: true },
    smsOptIn: { type: Boolean, default: true },
    appointmentUpdates: { type: Boolean, default: true },
    labUpdates: { type: Boolean, default: true },
    billingUpdates: { type: Boolean, default: true },
    prescriptionUpdates: { type: Boolean, default: true },
    marketingOptIn: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationPreferenceSchema.index({ hospitalId: 1, patientId: 1 }, { unique: true, sparse: true });
notificationPreferenceSchema.index({ hospitalId: 1, userId: 1 }, { sparse: true });
notificationPreferenceSchema.index({ hospitalId: 1, phone: 1 });

const NotificationPreference =
  (models.NotificationPreference as Model<NotificationPreferenceDocument>) ||
  model<NotificationPreferenceDocument>("NotificationPreference", notificationPreferenceSchema);

export default NotificationPreference;
