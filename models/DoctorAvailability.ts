import { Document, Model, Schema, model, models } from "mongoose";

export const availabilityStatuses = ["Active", "Cancelled", "Completed"] as const;
export type AvailabilityStatus = (typeof availabilityStatuses)[number];

export interface DoctorAvailabilityDocument extends Document {
  hospitalId: string;
  availabilityId: string;
  doctorUserId: string;
  doctorProfileId?: string;
  departmentId?: string;
  date: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  breakStartTime?: string;
  breakEndTime?: string;
  maxPatientsPerSlot: number;
  location?: string;
  room?: string;
  status: AvailabilityStatus;
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const doctorAvailabilitySchema = new Schema<DoctorAvailabilityDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    availabilityId: { type: String, required: true, trim: true },
    doctorUserId: { type: String, required: true, trim: true },
    doctorProfileId: { type: String, default: "", trim: true },
    departmentId: { type: String, default: "", trim: true },
    date: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    slotDurationMinutes: { type: Number, required: true, default: 30, min: 1 },
    breakStartTime: { type: String, default: "", trim: true },
    breakEndTime: { type: String, default: "", trim: true },
    maxPatientsPerSlot: { type: Number, required: true, default: 1, min: 1 },
    location: { type: String, default: "", trim: true },
    room: { type: String, default: "", trim: true },
    status: { type: String, enum: availabilityStatuses, default: "Active", required: true },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, default: "" },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

doctorAvailabilitySchema.index({ hospitalId: 1, availabilityId: 1 }, { unique: true });
doctorAvailabilitySchema.index({ hospitalId: 1, doctorUserId: 1, date: 1 });
doctorAvailabilitySchema.index({ hospitalId: 1, date: 1 });
doctorAvailabilitySchema.index({ hospitalId: 1, status: 1 });

const DoctorAvailability =
  (models.DoctorAvailability as Model<DoctorAvailabilityDocument>) ||
  model<DoctorAvailabilityDocument>("DoctorAvailability", doctorAvailabilitySchema);

export default DoctorAvailability;
