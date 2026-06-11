import { Document, Model, Schema, model, models } from "mongoose";

export const labOrderStatuses = [
  "Ordered",
  "Sample Collected",
  "Processing",
  "Ready",
  "Completed",
  "Cancelled",
] as const;

export type LabOrderStatus = (typeof labOrderStatuses)[number];

export interface LabOrderTestItem {
  testId?: string;
  testName: string;
  price: number;
  status: LabOrderStatus;
  needsMapping?: boolean;
}

export interface LabOrderDocument extends Document {
  hospitalId: string;
  labOrderId: string;
  patientId: string;
  appointmentId?: string;
  consultationId?: string;
  prescriptionId?: string;
  doctorUserId?: string;
  tests: LabOrderTestItem[];
  status: LabOrderStatus;
  priority: "Routine" | "Urgent";
  notes?: string;
  sampleCollectedAt?: Date;
  processingStartedAt?: Date;
  readyAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const labOrderTestSchema = new Schema<LabOrderTestItem>(
  {
    testId: { type: String, default: "", trim: true },
    testName: { type: String, required: true, trim: true },
    price: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: labOrderStatuses, default: "Ordered", required: true },
    needsMapping: { type: Boolean, default: false },
  },
  { _id: false },
);

const labOrderSchema = new Schema<LabOrderDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    labOrderId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    appointmentId: { type: String, default: "", trim: true },
    consultationId: { type: String, default: "", trim: true },
    prescriptionId: { type: String, default: "", trim: true },
    doctorUserId: { type: String, default: "", trim: true },
    tests: { type: [labOrderTestSchema], default: [] },
    status: { type: String, enum: labOrderStatuses, default: "Ordered", required: true },
    priority: { type: String, enum: ["Routine", "Urgent"], default: "Routine", required: true },
    notes: { type: String, default: "", trim: true },
    sampleCollectedAt: { type: Date },
    processingStartedAt: { type: Date },
    readyAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

labOrderSchema.index({ hospitalId: 1, labOrderId: 1 }, { unique: true });
labOrderSchema.index({ hospitalId: 1, patientId: 1 });
labOrderSchema.index({ hospitalId: 1, appointmentId: 1 });
labOrderSchema.index({ hospitalId: 1, consultationId: 1 });
labOrderSchema.index({ hospitalId: 1, prescriptionId: 1 });
labOrderSchema.index({ hospitalId: 1, doctorUserId: 1 });
labOrderSchema.index({ hospitalId: 1, status: 1 });
labOrderSchema.index({ hospitalId: 1, createdAt: 1 });

const LabOrder =
  (models.LabOrder as Model<LabOrderDocument>) || model<LabOrderDocument>("LabOrder", labOrderSchema);

export default LabOrder;
