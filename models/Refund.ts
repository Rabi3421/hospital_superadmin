import { Document, Model, Schema, model, models } from "mongoose";

export interface RefundDocument extends Document {
  hospitalId: string;
  refundId: string;
  billId: string;
  paymentId: string;
  patientId: string;
  amount: number;
  reason: string;
  refundMode: "Cash" | "UPI" | "Card" | "Bank Transfer" | "Original Payment Method" | "Other";
  transactionId?: string;
  status: "Pending" | "Approved" | "Processed" | "Rejected";
  approvedBy?: string;
  processedBy?: string;
  processedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<RefundDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    refundId: { type: String, required: true, trim: true },
    billId: { type: String, required: true, trim: true },
    paymentId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    refundMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Bank Transfer", "Original Payment Method", "Other"],
      required: true,
    },
    transactionId: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Processed", "Rejected"],
      default: "Pending",
      required: true,
    },
    approvedBy: { type: String, default: "" },
    processedBy: { type: String, default: "" },
    processedAt: { type: Date },
    rejectedBy: { type: String, default: "" },
    rejectionReason: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

refundSchema.index({ hospitalId: 1, refundId: 1 }, { unique: true });
refundSchema.index({ hospitalId: 1, billId: 1 });
refundSchema.index({ hospitalId: 1, paymentId: 1 });
refundSchema.index({ hospitalId: 1, patientId: 1 });
refundSchema.index({ hospitalId: 1, status: 1 });
refundSchema.index({ hospitalId: 1, createdAt: 1 });

const Refund = (models.Refund as Model<RefundDocument>) || model<RefundDocument>("Refund", refundSchema);

export default Refund;
