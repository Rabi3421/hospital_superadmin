import { Document, Model, Schema, model, models } from "mongoose";

export interface HospitalNoticeDocument extends Document {
  hospitalId: string;
  title: string;
  content: string;
  type: "General" | "Emergency" | "Holiday" | "Announcement";
  status: "Published" | "Draft";
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalNoticeSchema = new Schema<HospitalNoticeDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["General", "Emergency", "Holiday", "Announcement"],
      default: "General",
      required: true,
    },
    status: { type: String, enum: ["Published", "Draft"], default: "Draft", required: true },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

const HospitalNotice =
  (models.HospitalNotice as Model<HospitalNoticeDocument>) ||
  model<HospitalNoticeDocument>("HospitalNotice", hospitalNoticeSchema);

export default HospitalNotice;
