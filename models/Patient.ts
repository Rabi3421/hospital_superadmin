import { Document, Model, Schema, model, models } from "mongoose";

export interface PatientDocument extends Document {
  hospitalId: string;
  patientId: string;
  name: string;
  phone?: string;
  email?: string;
  profileCompleted: boolean;
  profileCompletedAt?: Date;
  gender?: "Male" | "Female" | "Other";
  dateOfBirth?: Date;
  age?: number;
  bloodGroup?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
  status: "Active" | "Inactive";
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<PatientDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    patientId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    profileCompleted: { type: Boolean, default: false, required: true },
    profileCompletedAt: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    dateOfBirth: { type: Date },
    age: { type: Number, min: 0 },
    bloodGroup: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    pincode: { type: String, default: "", trim: true },
    emergencyContactName: { type: String, default: "", trim: true },
    emergencyContactPhone: { type: String, default: "", trim: true },
    medicalHistory: { type: String, default: "", trim: true },
    allergies: { type: String, default: "", trim: true },
    currentMedications: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", required: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

patientSchema.index({ hospitalId: 1, patientId: 1 }, { unique: true });
patientSchema.index(
  { hospitalId: 1, phone: 1 },
  { partialFilterExpression: { phone: { $type: "string", $gt: "" } } },
);
patientSchema.index({ hospitalId: 1, name: 1 });

const Patient =
  (models.Patient as Model<PatientDocument>) || model<PatientDocument>("Patient", patientSchema);

export default Patient;
