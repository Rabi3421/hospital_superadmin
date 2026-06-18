import { Document, Model, Schema, model, models } from "mongoose";

export interface PaymentReminderDocument extends Document {
  hospitalId: string;
  reminderId: string;
  billId: string;
  patientId: string;
  channel: "Phone" | "WhatsApp" | "Email" | "SMS" | "In App";
  message: string;
  dueAmount: number;
  status: "Pending" | "Sent" | "Acknowledged" | "Failed";
  sentBy: string;
  sentAt: Date;
  acknowledgedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentReminderSchema = new Schema<PaymentReminderDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    reminderId: { type: String, required: true, trim: true },
    billId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    channel: {
      type: String,
      enum: ["Phone", "WhatsApp", "Email", "SMS", "In App"],
      required: true,
    },
    message: { type: String, required: true, trim: true },
    dueAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Pending", "Sent", "Acknowledged", "Failed"],
      default: "Sent",
      required: true,
    },
    sentBy: { type: String, default: "" },
    sentAt: { type: Date, required: true, default: Date.now },
    acknowledgedAt: { type: Date },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

paymentReminderSchema.index({ hospitalId: 1, reminderId: 1 }, { unique: true });
paymentReminderSchema.index({ hospitalId: 1, billId: 1 });
paymentReminderSchema.index({ hospitalId: 1, patientId: 1 });
paymentReminderSchema.index({ hospitalId: 1, status: 1 });

const PaymentReminder =
  (models.PaymentReminder as Model<PaymentReminderDocument>) ||
  model<PaymentReminderDocument>("PaymentReminder", paymentReminderSchema);

export default PaymentReminder;
