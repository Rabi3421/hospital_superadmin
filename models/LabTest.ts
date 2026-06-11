import { Document, Model, Schema, model, models } from "mongoose";

export interface LabTestDocument extends Document {
  hospitalId: string;
  testId: string;
  name: string;
  code?: string;
  category?: string;
  sampleType?: string;
  price: number;
  normalRange?: string;
  unit?: string;
  description?: string;
  preparationInstructions?: string;
  reportTemplate?: string;
  status: "Active" | "Inactive";
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const labTestSchema = new Schema<LabTestDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    testId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    category: { type: String, default: "", trim: true },
    sampleType: { type: String, default: "", trim: true },
    price: { type: Number, default: 0, min: 0 },
    normalRange: { type: String, default: "", trim: true },
    unit: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    preparationInstructions: { type: String, default: "", trim: true },
    reportTemplate: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", required: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

labTestSchema.index({ hospitalId: 1, testId: 1 }, { unique: true });
labTestSchema.index({ hospitalId: 1, code: 1 }, { unique: true, sparse: true });
labTestSchema.index({ hospitalId: 1, name: 1 });
labTestSchema.index({ hospitalId: 1, status: 1 });

const LabTest =
  (models.LabTest as Model<LabTestDocument>) || model<LabTestDocument>("LabTest", labTestSchema);

export default LabTest;
