import { Document, Model, Schema, model, models } from "mongoose";

export interface BillPaymentDocument extends Document {
  hospitalId: string;
  paymentId: string;
  billId: string;
  patientId: string;
  amount: number;
  paymentMode: "Cash" | "UPI" | "Card" | "Bank Transfer" | "Insurance" | "Other";
  transactionId?: string;
  paymentDate: Date;
  receivedBy?: string;
  status: "Success" | "Failed" | "Refunded";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const billPaymentSchema = new Schema<BillPaymentDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    paymentId: { type: String, required: true, trim: true },
    billId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Bank Transfer", "Insurance", "Other"],
      required: true,
    },
    transactionId: { type: String, default: "", trim: true },
    paymentDate: { type: Date, required: true, default: Date.now },
    receivedBy: { type: String, default: "" },
    status: { type: String, enum: ["Success", "Failed", "Refunded"], default: "Success", required: true },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

billPaymentSchema.index({ hospitalId: 1, paymentId: 1 }, { unique: true });
billPaymentSchema.index({ hospitalId: 1, billId: 1 });
billPaymentSchema.index({ hospitalId: 1, patientId: 1 });
billPaymentSchema.index({ hospitalId: 1, paymentDate: 1 });
billPaymentSchema.index({ hospitalId: 1, status: 1 });

const BillPayment =
  (models.BillPayment as Model<BillPaymentDocument>) ||
  model<BillPaymentDocument>("BillPayment", billPaymentSchema);

export default BillPayment;
