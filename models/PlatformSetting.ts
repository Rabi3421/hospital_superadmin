import { Document, Model, Schema, model, models } from "mongoose";

export interface PlatformSettingDocument extends Document {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const platformSettingSchema = new Schema<PlatformSettingDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

const PlatformSetting =
  (models.PlatformSetting as Model<PlatformSettingDocument>) ||
  model<PlatformSettingDocument>("PlatformSetting", platformSettingSchema);

export default PlatformSetting;
