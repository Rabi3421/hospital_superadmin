import { Document, Model, Schema, model, models } from "mongoose";

export interface HospitalDepartmentDocument extends Document {
  hospitalId: string;
  name: string;
  description?: string;
  icon?: string;
  status: "Active" | "Inactive";
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalDepartmentSchema = new Schema<HospitalDepartmentDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

hospitalDepartmentSchema.index({ hospitalId: 1, name: 1 }, { unique: true });

const HospitalDepartment =
  (models.HospitalDepartment as Model<HospitalDepartmentDocument>) ||
  model<HospitalDepartmentDocument>("HospitalDepartment", hospitalDepartmentSchema);

export default HospitalDepartment;
