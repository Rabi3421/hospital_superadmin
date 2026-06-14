import { Document, Model, Schema, model, models } from "mongoose";

export interface HospitalWebsitePageDocument extends Document {
  hospitalId: string;
  pageKey: string;
  label: string;
  status: "Published" | "Draft";
  content: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalWebsitePageSchema = new Schema<HospitalWebsitePageDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    pageKey: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Published", "Draft"], default: "Published", required: true },
    content: { type: Map, of: String, default: {} },
  },
  { timestamps: true },
);

hospitalWebsitePageSchema.index({ hospitalId: 1, pageKey: 1 }, { unique: true });

const HospitalWebsitePage =
  (models.HospitalWebsitePage as Model<HospitalWebsitePageDocument>) ||
  model<HospitalWebsitePageDocument>("HospitalWebsitePage", hospitalWebsitePageSchema);

export default HospitalWebsitePage;
