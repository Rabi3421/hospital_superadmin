import { Document, Model, Schema, model, models } from "mongoose";

export interface DepositApplication {
  billId: string;
  amount: number;
  appliedAt: Date;
}

export interface PatientDepositDocument extends Document {
  hospitalId: string;
  depositId: string;
  patientId: string;
  amount: number;
  usedAmount: number;
  balanceAmount: number;
  paymentMode: "Cash" | "UPI" | "Card" | "Bank Transfer" | "Other";
  transactionId?: string;
  depositDate: Date;
  purpose?: string;
  status: "Active" | "Partially Used" | "Fully Used" | "Refunded";
  appliedToBills: DepositApplication[];
  refundedAmount: number;
  notes?: string;
  receivedBy: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const depositApplicationSchema = new Schema<DepositApplication>(
  {
    billId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    appliedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const patientDepositSchema = new Schema<PatientDepositDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    depositId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    usedAmount: { type: Number, default: 0, min: 0 },
    balanceAmount: { type: Number, default: 0, min: 0 },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Bank Transfer", "Other"],
      required: true,
    },
    transactionId: { type: String, default: "", trim: true },
    depositDate: { type: Date, required: true, default: Date.now },
    purpose: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["Active", "Partially Used", "Fully Used", "Refunded"],
      default: "Active",
      required: true,
    },
    appliedToBills: { type: [depositApplicationSchema], default: [] },
    refundedAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", trim: true },
    receivedBy: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

patientDepositSchema.index({ hospitalId: 1, depositId: 1 }, { unique: true });
patientDepositSchema.index({ hospitalId: 1, patientId: 1 });
patientDepositSchema.index({ hospitalId: 1, status: 1 });
patientDepositSchema.index({ hospitalId: 1, depositDate: 1 });

const PatientDeposit =
  (models.PatientDeposit as Model<PatientDepositDocument>) ||
  model<PatientDepositDocument>("PatientDeposit", patientDepositSchema);

export default PatientDeposit;
