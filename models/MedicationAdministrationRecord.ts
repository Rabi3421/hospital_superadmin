import { Document, Model, Schema, model, models } from "mongoose";

export const medicationRoutes = ["Oral", "IV", "IM", "SC", "Topical", "Inhalation", "Other"] as const;

export type MedicationRoute = (typeof medicationRoutes)[number];

export const medicationAdministrationStatuses = ["Administered", "Skipped", "Cancelled"] as const;

export type MedicationAdministrationStatus = (typeof medicationAdministrationStatuses)[number];

export interface MedicationAdministrationRecordDocument extends Document {
  hospitalId: string;
  administrationId: string;
  patientId: string;
  appointmentId?: string;
  prescriptionId?: string;
  medicineName: string;
  dose?: string;
  route: MedicationRoute;
  administeredAt: Date;
  administeredBy: string;
  notes?: string;
  status: MedicationAdministrationStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const medicationAdministrationRecordSchema = new Schema<MedicationAdministrationRecordDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    administrationId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    appointmentId: { type: String, default: "", trim: true },
    prescriptionId: { type: String, default: "", trim: true },
    medicineName: { type: String, required: true, trim: true },
    dose: { type: String, default: "", trim: true },
    route: { type: String, enum: medicationRoutes, default: "Oral", required: true },
    administeredAt: { type: Date, required: true },
    administeredBy: { type: String, required: true, trim: true },
    notes: { type: String, default: "", trim: true },
    status: { type: String, enum: medicationAdministrationStatuses, default: "Administered", required: true },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

medicationAdministrationRecordSchema.index({ hospitalId: 1, administrationId: 1 }, { unique: true });
medicationAdministrationRecordSchema.index({ hospitalId: 1, patientId: 1, administeredAt: 1 });
medicationAdministrationRecordSchema.index({ hospitalId: 1, administeredBy: 1, administeredAt: 1 });

const MedicationAdministrationRecord =
  (models.MedicationAdministrationRecord as Model<MedicationAdministrationRecordDocument>) ||
  model<MedicationAdministrationRecordDocument>(
    "MedicationAdministrationRecord",
    medicationAdministrationRecordSchema,
  );

export default MedicationAdministrationRecord;
