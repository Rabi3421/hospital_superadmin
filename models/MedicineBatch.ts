import { Document, Model, Schema, model, models } from "mongoose";

export interface MedicineBatchDocument extends Document {
  hospitalId: string;
  batchId: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: Date;
  purchasePrice: number;
  sellingPrice: number;
  quantityReceived: number;
  quantityAvailable: number;
  supplierName?: string;
  receivedDate: Date;
  status: "Active" | "Expired" | "Finished" | "Cancelled";
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const medicineBatchSchema = new Schema<MedicineBatchDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    batchId: { type: String, required: true, trim: true },
    medicineId: { type: String, required: true, trim: true },
    batchNumber: { type: String, required: true, trim: true },
    expiryDate: { type: Date, required: true },
    purchasePrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    quantityReceived: { type: Number, required: true, min: 0 },
    quantityAvailable: { type: Number, required: true, min: 0 },
    supplierName: { type: String, default: "", trim: true },
    receivedDate: { type: Date, default: Date.now, required: true },
    status: { type: String, enum: ["Active", "Expired", "Finished", "Cancelled"], default: "Active", required: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

medicineBatchSchema.index({ hospitalId: 1, batchId: 1 }, { unique: true });
medicineBatchSchema.index({ hospitalId: 1, medicineId: 1 });
medicineBatchSchema.index({ hospitalId: 1, batchNumber: 1 });
medicineBatchSchema.index({ hospitalId: 1, expiryDate: 1 });
medicineBatchSchema.index({ hospitalId: 1, status: 1 });

const MedicineBatch =
  (models.MedicineBatch as Model<MedicineBatchDocument>) ||
  model<MedicineBatchDocument>("MedicineBatch", medicineBatchSchema);

export default MedicineBatch;
