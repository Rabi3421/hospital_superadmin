import { Document, Model, Schema, model, models } from "mongoose";

export interface PlatformPaymentDocument extends Document {
  hospitalId: string;
  amount: number;
  paymentDate: Date;
  paymentMode: "Cash" | "UPI" | "Bank Transfer" | "Card" | "Online";
  transactionId?: string;
  billingMonth: string;
  status: "Paid" | "Pending" | "Failed" | "Refunded";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const platformPaymentSchema = new Schema<PlatformPaymentDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, required: true },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Bank Transfer", "Card", "Online"],
      required: true,
    },
    transactionId: { type: String, default: "" },
    billingMonth: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Paid", "Pending", "Failed", "Refunded"],
      default: "Pending",
      required: true,
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

const PlatformPayment =
  (models.PlatformPayment as Model<PlatformPaymentDocument>) ||
  model<PlatformPaymentDocument>("PlatformPayment", platformPaymentSchema);

export default PlatformPayment;
