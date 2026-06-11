import { Document, Model, Schema, model, models } from "mongoose";
import { hospitalRoles, type HospitalRole } from "@/lib/hospital-permissions";

export interface HospitalUserDocument extends Document {
  hospitalId: string;
  patientId?: string;
  name: string;
  email?: string;
  phone?: string;
  passwordHash: string;
  role: HospitalRole;
  permissions: string[];
  status: "Active" | "Blocked";
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalUserSchema = new Schema<HospitalUserDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    patientId: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: hospitalRoles, required: true },
    permissions: [{ type: String }],
    status: { type: String, enum: ["Active", "Blocked"], default: "Active", required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

hospitalUserSchema.index(
  { hospitalId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string", $gt: "" } } },
);
hospitalUserSchema.index(
  { hospitalId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string", $gt: "" } } },
);
hospitalUserSchema.index({ hospitalId: 1, patientId: 1 });

hospitalUserSchema.pre("validate", function validatePatientContact() {
  if (this.role === "PATIENT" && !this.email?.trim() && !this.phone?.trim()) {
    this.invalidate("email", "Patient users require an email or phone number");
  }
});

const HospitalUser =
  (models.HospitalUser as Model<HospitalUserDocument>) ||
  model<HospitalUserDocument>("HospitalUser", hospitalUserSchema);

export default HospitalUser;
