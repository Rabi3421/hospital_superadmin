import { Document, Model, Schema, model, models } from "mongoose";

export interface StockMovementDocument extends Document {
  hospitalId: string;
  movementId: string;
  medicineId: string;
  batchId: string;
  type: "Stock In" | "Sale" | "Adjustment" | "Return" | "Cancel Sale";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  referenceType: "Batch" | "Sale" | "Manual" | "Prescription";
  referenceId?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<StockMovementDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    movementId: { type: String, required: true, trim: true },
    medicineId: { type: String, required: true, trim: true },
    batchId: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Stock In", "Sale", "Adjustment", "Return", "Cancel Sale"], required: true },
    quantity: { type: Number, required: true },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    reason: { type: String, default: "", trim: true },
    referenceType: { type: String, enum: ["Batch", "Sale", "Manual", "Prescription"], required: true },
    referenceId: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

stockMovementSchema.index({ hospitalId: 1, movementId: 1 }, { unique: true });
stockMovementSchema.index({ hospitalId: 1, medicineId: 1 });
stockMovementSchema.index({ hospitalId: 1, batchId: 1 });
stockMovementSchema.index({ hospitalId: 1, type: 1 });
stockMovementSchema.index({ hospitalId: 1, createdAt: 1 });

const StockMovement =
  (models.StockMovement as Model<StockMovementDocument>) ||
  model<StockMovementDocument>("StockMovement", stockMovementSchema);

export default StockMovement;
