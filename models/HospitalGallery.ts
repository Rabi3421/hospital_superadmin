import { Document, Model, Schema, model, models } from "mongoose";

export interface HospitalGalleryDocument extends Document {
  hospitalId: string;
  title: string;
  imageUrl: string;
  category?: string;
  status: "Active" | "Inactive";
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalGallerySchema = new Schema<HospitalGalleryDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    category: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const HospitalGallery =
  (models.HospitalGallery as Model<HospitalGalleryDocument>) ||
  model<HospitalGalleryDocument>("HospitalGallery", hospitalGallerySchema);

export default HospitalGallery;
