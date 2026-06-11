import { Document, Model, Schema, model, models } from "mongoose";

export interface PrescriptionMedicine {
  medicineName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface PrescriptionTestRecommendation {
  testName: string;
  instructions?: string;
  priority: "Routine" | "Urgent";
}

export interface PrescriptionDocument extends Document {
  hospitalId: string;
  prescriptionId: string;
  consultationId: string;
  appointmentId: string;
  patientId: string;
  doctorUserId: string;
  medicines: PrescriptionMedicine[];
  testsRecommended: PrescriptionTestRecommendation[];
  generalInstructions?: string;
  followUpDate?: Date;
  status: "Draft" | "Issued" | "Cancelled";
  issuedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const medicineSchema = new Schema<PrescriptionMedicine>(
  {
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, default: "", trim: true },
    frequency: { type: String, default: "", trim: true },
    duration: { type: String, default: "", trim: true },
    instructions: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const testRecommendationSchema = new Schema<PrescriptionTestRecommendation>(
  {
    testName: { type: String, required: true, trim: true },
    instructions: { type: String, default: "", trim: true },
    priority: { type: String, enum: ["Routine", "Urgent"], default: "Routine", required: true },
  },
  { _id: false },
);

const prescriptionSchema = new Schema<PrescriptionDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    prescriptionId: { type: String, required: true, trim: true },
    consultationId: { type: String, required: true, trim: true },
    appointmentId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    doctorUserId: { type: String, required: true, trim: true },
    medicines: { type: [medicineSchema], default: [] },
    testsRecommended: { type: [testRecommendationSchema], default: [] },
    generalInstructions: { type: String, default: "", trim: true },
    followUpDate: { type: Date },
    status: { type: String, enum: ["Draft", "Issued", "Cancelled"], default: "Draft", required: true },
    issuedAt: { type: Date },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

prescriptionSchema.index({ hospitalId: 1, prescriptionId: 1 }, { unique: true });
prescriptionSchema.index({ hospitalId: 1, consultationId: 1 });
prescriptionSchema.index({ hospitalId: 1, appointmentId: 1 });
prescriptionSchema.index({ hospitalId: 1, patientId: 1 });
prescriptionSchema.index({ hospitalId: 1, doctorUserId: 1 });

const Prescription =
  (models.Prescription as Model<PrescriptionDocument>) ||
  model<PrescriptionDocument>("Prescription", prescriptionSchema);

export default Prescription;
