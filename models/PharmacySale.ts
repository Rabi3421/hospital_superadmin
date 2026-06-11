import { Document, Model, Schema, model, models } from "mongoose";

export interface PharmacySaleItem {
  medicineId: string;
  batchId: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PharmacySaleDocument extends Document {
  hospitalId: string;
  saleId: string;
  patientId: string;
  prescriptionId?: string;
  appointmentId?: string;
  consultationId?: string;
  items: PharmacySaleItem[];
  subtotal: number;
  discountType: "None" | "Flat" | "Percentage";
  discountValue: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMode: "Cash" | "UPI" | "Card" | "Bank Transfer" | "Other";
  paymentStatus: "Unpaid" | "Partially Paid" | "Paid";
  saleStatus: "Completed" | "Cancelled";
  notes?: string;
  soldBy?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pharmacySaleItemSchema = new Schema<PharmacySaleItem>(
  {
    medicineId: { type: String, required: true, trim: true },
    batchId: { type: String, required: true, trim: true },
    medicineName: { type: String, required: true, trim: true },
    batchNumber: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const pharmacySaleSchema = new Schema<PharmacySaleDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    saleId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    prescriptionId: { type: String, default: "", trim: true },
    appointmentId: { type: String, default: "", trim: true },
    consultationId: { type: String, default: "", trim: true },
    items: { type: [pharmacySaleItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ["None", "Flat", "Percentage"], default: "None", required: true },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    paymentMode: { type: String, enum: ["Cash", "UPI", "Card", "Bank Transfer", "Other"], default: "Cash", required: true },
    paymentStatus: { type: String, enum: ["Unpaid", "Partially Paid", "Paid"], default: "Unpaid", required: true },
    saleStatus: { type: String, enum: ["Completed", "Cancelled"], default: "Completed", required: true },
    notes: { type: String, default: "", trim: true },
    soldBy: { type: String, default: "" },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

pharmacySaleSchema.index({ hospitalId: 1, saleId: 1 }, { unique: true });
pharmacySaleSchema.index({ hospitalId: 1, patientId: 1 });
pharmacySaleSchema.index({ hospitalId: 1, prescriptionId: 1 });
pharmacySaleSchema.index({ hospitalId: 1, saleStatus: 1 });
pharmacySaleSchema.index({ hospitalId: 1, createdAt: 1 });

const PharmacySale =
  (models.PharmacySale as Model<PharmacySaleDocument>) ||
  model<PharmacySaleDocument>("PharmacySale", pharmacySaleSchema);

export default PharmacySale;
