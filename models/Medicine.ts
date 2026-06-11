import { Document, Model, Schema, model, models } from "mongoose";

export interface MedicineDocument extends Document {
  hospitalId: string;
  medicineId: string;
  name: string;
  genericName?: string;
  brandName?: string;
  category?: string;
  dosageForm: "Tablet" | "Capsule" | "Syrup" | "Injection" | "Cream" | "Drops" | "Inhaler" | "Other";
  strength?: string;
  manufacturer?: string;
  hsnCode?: string;
  unit?: string;
  purchasePrice: number;
  sellingPrice: number;
  reorderLevel: number;
  status: "Active" | "Inactive";
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const medicineSchema = new Schema<MedicineDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    medicineId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    genericName: { type: String, default: "", trim: true },
    brandName: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    dosageForm: {
      type: String,
      enum: ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Drops", "Inhaler", "Other"],
      default: "Other",
      required: true,
    },
    strength: { type: String, default: "", trim: true },
    manufacturer: { type: String, default: "", trim: true },
    hsnCode: { type: String, default: "", trim: true },
    unit: { type: String, default: "", trim: true },
    purchasePrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", required: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

medicineSchema.index({ hospitalId: 1, medicineId: 1 }, { unique: true });
medicineSchema.index({ hospitalId: 1, name: 1 });
medicineSchema.index({ hospitalId: 1, genericName: 1 });
medicineSchema.index({ hospitalId: 1, status: 1 });

const Medicine =
  (models.Medicine as Model<MedicineDocument>) || model<MedicineDocument>("Medicine", medicineSchema);

export default Medicine;
