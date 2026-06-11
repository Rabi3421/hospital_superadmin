import { Document, Model, Schema, model, models } from "mongoose";

export type HospitalStatus = "Trial" | "Active" | "Suspended" | "Cancelled" | "Pending";
export type HospitalType = "Clinic" | "Hospital" | "Diagnostic Center" | "Nursing Home";
export type WebsiteStatus = "Live" | "Maintenance" | "Coming Soon";

export interface HospitalDocument extends Document {
  hospitalId: string;
  name: string;
  slug: string;
  type: HospitalType;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  logoUrl?: string;
  registrationNumber?: string;
  gstNumber?: string;
  websiteStatus: WebsiteStatus;
  status: HospitalStatus;
  subscriptionPlan: string;
  trialStartDate?: Date;
  trialEndDate?: Date;
  billingStartDate?: Date;
  nextBillingDate?: Date;
  monthlyPrice: number;
  maxDoctors: number;
  maxStaff: number;
  maxPatients: number;
  settings: {
    currency: string;
    timezone: string;
    appointmentTokenPrefix: string;
    receiptPrefix: string;
    defaultConsultationFee: number;
    workingHours: string;
    emergencyContact: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const hospitalSchema = new Schema<HospitalDocument>(
  {
    hospitalId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: {
      type: String,
      enum: ["Clinic", "Hospital", "Diagnostic Center", "Nursing Home"],
      required: true,
    },
    ownerName: { type: String, required: true, trim: true },
    ownerPhone: { type: String, required: true, trim: true },
    ownerEmail: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    logoUrl: { type: String, default: "" },
    registrationNumber: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    websiteStatus: {
      type: String,
      enum: ["Live", "Maintenance", "Coming Soon"],
      default: "Coming Soon",
      required: true,
    },
    status: {
      type: String,
      enum: ["Trial", "Active", "Suspended", "Cancelled", "Pending"],
      default: "Trial",
      required: true,
    },
    subscriptionPlan: { type: String, default: "Trial" },
    trialStartDate: { type: Date },
    trialEndDate: { type: Date },
    billingStartDate: { type: Date },
    nextBillingDate: { type: Date },
    monthlyPrice: { type: Number, default: 0, min: 0 },
    maxDoctors: { type: Number, default: 5, min: 0 },
    maxStaff: { type: Number, default: 20, min: 0 },
    maxPatients: { type: Number, default: 1000, min: 0 },
    settings: {
      currency: { type: String, default: "INR" },
      timezone: { type: String, default: "Asia/Kolkata" },
      appointmentTokenPrefix: { type: String, default: "APT" },
      receiptPrefix: { type: String, default: "RCP" },
      defaultConsultationFee: { type: Number, default: 0, min: 0 },
      workingHours: { type: String, default: "" },
      emergencyContact: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

const Hospital =
  (models.Hospital as Model<HospitalDocument>) ||
  model<HospitalDocument>("Hospital", hospitalSchema);

export default Hospital;
