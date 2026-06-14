import { Document, Model, Schema, model, models } from "mongoose";

export interface BillingReminderDocument extends Document {
  hospitalId: string;
  billingMonth: string;
  channel: "Email" | "Phone" | "WhatsApp" | "In App";
  recipient: string;
  stage: "Upcoming" | "Due" | "Grace" | "Suspended" | "Manual";
  message: string;
  status: "Logged" | "Sent" | "Failed";
  sentBy: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const billingReminderSchema = new Schema<BillingReminderDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    billingMonth: { type: String, required: true, trim: true },
    channel: { type: String, enum: ["Email", "Phone", "WhatsApp", "In App"], required: true },
    recipient: { type: String, required: true, trim: true },
    stage: { type: String, enum: ["Upcoming", "Due", "Grace", "Suspended", "Manual"], required: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Logged", "Sent", "Failed"], default: "Logged", required: true },
    sentBy: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true },
);

const BillingReminder =
  (models.BillingReminder as Model<BillingReminderDocument>) ||
  model<BillingReminderDocument>("BillingReminder", billingReminderSchema);

export default BillingReminder;
