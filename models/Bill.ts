import { Document, Model, Schema, model, models } from "mongoose";

export interface BillItem {
  itemType: "Consultation" | "Lab" | "Pharmacy" | "Procedure" | "Other";
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface BillDocument extends Document {
  hospitalId: string;
  billId: string;
  patientId: string;
  appointmentId?: string;
  consultationId?: string;
  doctorUserId?: string;
  items: BillItem[];
  subtotal: number;
  discountType: "None" | "Flat" | "Percentage";
  discountValue: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  status: "Draft" | "Unpaid" | "Partially Paid" | "Paid" | "Cancelled";
  sourceType: "Manual" | "Consultation" | "LabOrder" | "PharmacySale" | "Mixed";
  sourceId?: string;
  sourceRefId?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
  createdBy?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const billItemSchema = new Schema<BillItem>(
  {
    itemType: {
      type: String,
      enum: ["Consultation", "Lab", "Pharmacy", "Procedure", "Other"],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const billSchema = new Schema<BillDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    billId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    appointmentId: { type: String, default: "", trim: true },
    consultationId: { type: String, default: "", trim: true },
    doctorUserId: { type: String, default: "", trim: true },
    items: { type: [billItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ["None", "Flat", "Percentage"], default: "None", required: true },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["Draft", "Unpaid", "Partially Paid", "Paid", "Cancelled"],
      default: "Unpaid",
      required: true,
    },
    sourceType: {
      type: String,
      enum: ["Manual", "Consultation", "LabOrder", "PharmacySale", "Mixed"],
      default: "Manual",
      required: true,
    },
    sourceId: { type: String, trim: true },
    sourceRefId: { type: String, default: "", trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "" },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

billSchema.index({ hospitalId: 1, billId: 1 }, { unique: true });
billSchema.index({ hospitalId: 1, patientId: 1 });
billSchema.index({ hospitalId: 1, appointmentId: 1 });
billSchema.index({ hospitalId: 1, consultationId: 1 });
billSchema.index({ hospitalId: 1, status: 1 });
billSchema.index({ hospitalId: 1, createdAt: 1 });
billSchema.index(
  { hospitalId: 1, sourceType: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceType: { $in: ["Consultation", "LabOrder", "PharmacySale"] },
      sourceId: { $exists: true, $type: "string", $gt: "" },
    },
  },
);

const Bill = (models.Bill as Model<BillDocument>) || model<BillDocument>("Bill", billSchema);

export default Bill;
