import { Document, Model, Schema, model, models } from "mongoose";

export interface HospitalDoctorPublicProfileDocument extends Document {
  doctorId?: string;
  hospitalId: string;
  userId?: string;
  name: string;
  departmentId?: string;
  specialization?: string;
  qualification?: string;
  experienceYears: number;
  consultationFee: number;
  photoUrl?: string;
  bio?: string;
  availableDays: string[];
  availableTime?: string;
  status: "Active" | "Inactive";
  createdAt: Date;
  updatedAt: Date;
}

const hospitalDoctorPublicProfileSchema = new Schema<HospitalDoctorPublicProfileDocument>(
  {
    doctorId: { type: String, trim: true },
    hospitalId: { type: String, required: true, index: true },
    userId: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    departmentId: { type: String, default: "" },
    specialization: { type: String, default: "" },
    qualification: { type: String, default: "" },
    experienceYears: { type: Number, default: 0, min: 0 },
    consultationFee: { type: Number, default: 0, min: 0 },
    photoUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    availableDays: [{ type: String }],
    availableTime: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", required: true },
  },
  { timestamps: true },
);

hospitalDoctorPublicProfileSchema.index({ doctorId: 1 }, { unique: true, sparse: true });
hospitalDoctorPublicProfileSchema.index({ hospitalId: 1, userId: 1 });

const HospitalDoctorPublicProfile =
  (models.HospitalDoctorPublicProfile as Model<HospitalDoctorPublicProfileDocument>) ||
  model<HospitalDoctorPublicProfileDocument>("HospitalDoctorPublicProfile", hospitalDoctorPublicProfileSchema);

export default HospitalDoctorPublicProfile;
