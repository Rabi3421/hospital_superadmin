import { Document, Model, Schema, model, models } from "mongoose";

export interface ReferralPartnerDocument extends Document {
  referralPartnerId: string;
  name: string;
  phone?: string;
  email?: string;
  organization?: string;
  type: "Individual" | "Employee" | "Agency" | "Partner";
  status: "Active" | "Inactive";
  payoutNote?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const referralPartnerSchema = new Schema<ReferralPartnerDocument>(
  {
    referralPartnerId: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    organization: { type: String, default: "", trim: true },
    type: { type: String, enum: ["Individual", "Employee", "Agency", "Partner"], default: "Individual", required: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", required: true },
    payoutNote: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

referralPartnerSchema.index({ name: 1, phone: 1 });

const ReferralPartner =
  (models.ReferralPartner as Model<ReferralPartnerDocument>) ||
  model<ReferralPartnerDocument>("ReferralPartner", referralPartnerSchema);

export default ReferralPartner;
