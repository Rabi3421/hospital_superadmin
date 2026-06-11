import { Document, Model, Schema, model, models } from "mongoose";

export const slotStatuses = ["Available", "Booked", "Blocked", "Cancelled", "Completed"] as const;
export type SlotStatus = (typeof slotStatuses)[number];

export interface AppointmentSlotDocument extends Document {
  hospitalId: string;
  slotId: string;
  availabilityId: string;
  doctorUserId: string;
  doctorProfileId?: string;
  departmentId?: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  maxBookings: number;
  bookedCount: number;
  status: SlotStatus;
  appointmentIds: string[];
  location?: string;
  room?: string;
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSlotSchema = new Schema<AppointmentSlotDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    slotId: { type: String, required: true, trim: true },
    availabilityId: { type: String, required: true, trim: true },
    doctorUserId: { type: String, required: true, trim: true },
    doctorProfileId: { type: String, default: "", trim: true },
    departmentId: { type: String, default: "", trim: true },
    date: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    maxBookings: { type: Number, required: true, default: 1, min: 1 },
    bookedCount: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: slotStatuses, default: "Available", required: true },
    appointmentIds: [{ type: String }],
    location: { type: String, default: "", trim: true },
    room: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

appointmentSlotSchema.index({ hospitalId: 1, slotId: 1 }, { unique: true });
appointmentSlotSchema.index({ hospitalId: 1, doctorUserId: 1, date: 1, startTime: 1 }, { unique: true });
appointmentSlotSchema.index({ hospitalId: 1, doctorUserId: 1, date: 1, status: 1 });
appointmentSlotSchema.index({ hospitalId: 1, date: 1, status: 1 });
appointmentSlotSchema.index({ hospitalId: 1, availabilityId: 1 });

const AppointmentSlot =
  (models.AppointmentSlot as Model<AppointmentSlotDocument>) ||
  model<AppointmentSlotDocument>("AppointmentSlot", appointmentSlotSchema);

export default AppointmentSlot;
