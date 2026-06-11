import { Document, Model, Schema, model, models } from "mongoose";

export interface LabReportResult {
  testId?: string;
  testName: string;
  value?: string;
  unit?: string;
  normalRange?: string;
  flag: "Normal" | "High" | "Low" | "Critical" | "Not Applicable";
  remarks?: string;
}

export interface LabReportDocument extends Document {
  hospitalId: string;
  reportId: string;
  labOrderId: string;
  patientId: string;
  doctorUserId?: string;
  results: LabReportResult[];
  summary?: string;
  reportFileUrl?: string;
  status: "Draft" | "Published" | "Cancelled";
  preparedBy?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const labReportResultSchema = new Schema<LabReportResult>(
  {
    testId: { type: String, default: "", trim: true },
    testName: { type: String, required: true, trim: true },
    value: { type: String, default: "", trim: true },
    unit: { type: String, default: "", trim: true },
    normalRange: { type: String, default: "", trim: true },
    flag: {
      type: String,
      enum: ["Normal", "High", "Low", "Critical", "Not Applicable"],
      default: "Not Applicable",
      required: true,
    },
    remarks: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const labReportSchema = new Schema<LabReportDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    reportId: { type: String, required: true, trim: true },
    labOrderId: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, trim: true },
    doctorUserId: { type: String, default: "", trim: true },
    results: { type: [labReportResultSchema], default: [] },
    summary: { type: String, default: "", trim: true },
    reportFileUrl: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Draft", "Published", "Cancelled"], default: "Draft", required: true },
    preparedBy: { type: String, default: "" },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

labReportSchema.index({ hospitalId: 1, reportId: 1 }, { unique: true });
labReportSchema.index({ hospitalId: 1, labOrderId: 1 });
labReportSchema.index({ hospitalId: 1, patientId: 1 });
labReportSchema.index({ hospitalId: 1, doctorUserId: 1 });
labReportSchema.index({ hospitalId: 1, status: 1 });
labReportSchema.index({ hospitalId: 1, createdAt: 1 });

const LabReport =
  (models.LabReport as Model<LabReportDocument>) ||
  model<LabReportDocument>("LabReport", labReportSchema);

export default LabReport;
