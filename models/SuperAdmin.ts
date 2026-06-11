import { Document, Model, Schema, model, models } from "mongoose";

export type SuperAdminStatus = "Active" | "Blocked";

export interface SuperAdminDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: "SUPERADMIN";
  status: SuperAdminStatus;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const superAdminSchema = new Schema<SuperAdminDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["SUPERADMIN"], default: "SUPERADMIN", required: true },
    status: { type: String, enum: ["Active", "Blocked"], default: "Active", required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

const SuperAdmin =
  (models.SuperAdmin as Model<SuperAdminDocument>) ||
  model<SuperAdminDocument>("SuperAdmin", superAdminSchema);

export default SuperAdmin;
