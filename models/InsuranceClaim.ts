import { Document, Model, Schema, model, models } from "mongoose";

export interface InsuranceClaimDocument extends Document {
  hospitalId: string;
  claimId: string;
  billId: string;
  patientId: string;
  insuranceProvider: string;
  policyNumber: string;
  claimAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
  status:
    | "Draft"
    | "Submitted"
    | "Under Review"
    | "Approved"
    | "Partially Approved"
    | "Rejected"
    | "Settled"
    | "Appealed";
  submittedAt?: Date;
  reviewedAt?: Date;
  settledAt?: Date;
  tpaName?: string;
  tpaReferenceNumber?: string;
  preAuthNumber?: string;
  diagnosisCode?: string;
  remarks?: string;
  rejectionReason?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const insuranceClaimSchema = new Schema<InsuranceClaimDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    claimId: { type: String, required: true, trim: true },
    billId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    insuranceProvider: { type: String, required: true, trim: true },
    policyNumber: { type: String, required: true, trim: true },
    claimAmount: { type: Number, required: true, min: 0 },
    approvedAmount: { type: Number, default: 0, min: 0 },
    rejectedAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["Draft", "Submitted", "Under Review", "Approved", "Partially Approved", "Rejected", "Settled", "Appealed"],
      default: "Draft",
      required: true,
    },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    settledAt: { type: Date },
    tpaName: { type: String, default: "", trim: true },
    tpaReferenceNumber: { type: String, default: "", trim: true },
    preAuthNumber: { type: String, default: "", trim: true },
    diagnosisCode: { type: String, default: "", trim: true },
    remarks: { type: String, default: "", trim: true },
    rejectionReason: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

insuranceClaimSchema.index({ hospitalId: 1, claimId: 1 }, { unique: true });
insuranceClaimSchema.index({ hospitalId: 1, billId: 1 });
insuranceClaimSchema.index({ hospitalId: 1, patientId: 1 });
insuranceClaimSchema.index({ hospitalId: 1, status: 1 });
insuranceClaimSchema.index({ hospitalId: 1, insuranceProvider: 1 });
insuranceClaimSchema.index({ hospitalId: 1, submittedAt: 1 });

const InsuranceClaim =
  (models.InsuranceClaim as Model<InsuranceClaimDocument>) ||
  model<InsuranceClaimDocument>("InsuranceClaim", insuranceClaimSchema);

export default InsuranceClaim;
