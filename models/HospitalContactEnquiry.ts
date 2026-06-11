import { Document, Model, Schema, model, models } from "mongoose";

export interface HospitalContactEnquiryDocument extends Document {
  hospitalId: string;
  name: string;
  phone: string;
  email?: string;
  message: string;
  status: "New" | "Read" | "Replied" | "Closed";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalContactEnquirySchema = new Schema<HospitalContactEnquiryDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["New", "Read", "Replied", "Closed"], default: "New", required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

const HospitalContactEnquiry =
  (models.HospitalContactEnquiry as Model<HospitalContactEnquiryDocument>) ||
  model<HospitalContactEnquiryDocument>("HospitalContactEnquiry", hospitalContactEnquirySchema);

export default HospitalContactEnquiry;
