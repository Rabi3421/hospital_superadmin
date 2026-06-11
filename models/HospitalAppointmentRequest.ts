import { Document, Model, Schema, model, models } from "mongoose";

export interface HospitalAppointmentRequestDocument extends Document {
  hospitalId: string;
  patientId?: string;
  userId?: string;
  appointmentId?: string;
  patientName: string;
  phone?: string;
  email?: string;
  departmentId?: string;
  doctorId?: string;
  doctorUserId?: string;
  doctorProfileId?: string;
  source?: "Public Website" | "Patient Portal";
  preferredDate: Date;
  preferredTime: string;
  message?: string;
  status: "New" | "Confirmed" | "Cancelled" | "Completed";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalAppointmentRequestSchema = new Schema<HospitalAppointmentRequestDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    patientId: { type: String, default: "", trim: true },
    userId: { type: String, default: "", trim: true },
    appointmentId: { type: String, default: "", trim: true },
    patientName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    departmentId: { type: String, default: "" },
    doctorId: { type: String, default: "" },
    doctorUserId: { type: String, default: "", trim: true },
    doctorProfileId: { type: String, default: "", trim: true },
    source: { type: String, enum: ["Public Website", "Patient Portal"], default: "Public Website", required: true },
    preferredDate: { type: Date, required: true },
    preferredTime: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    status: { type: String, enum: ["New", "Confirmed", "Cancelled", "Completed"], default: "New", required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

const HospitalAppointmentRequest =
  (models.HospitalAppointmentRequest as Model<HospitalAppointmentRequestDocument>) ||
  model<HospitalAppointmentRequestDocument>("HospitalAppointmentRequest", hospitalAppointmentRequestSchema);

export default HospitalAppointmentRequest;
