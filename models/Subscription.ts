import { Document, Model, Schema, model, models } from "mongoose";

export interface SubscriptionDocument extends Document {
  hospitalId: string;
  planName: string;
  monthlyPrice: number;
  priceType: "Standard" | "Negotiated" | "Free";
  pricingNote?: string;
  billingCycle: "Monthly" | "Quarterly" | "Yearly";
  status: "Trial" | "Active" | "Overdue" | "Suspended" | "Cancelled";
  startDate: Date;
  endDate?: Date;
  nextBillingDate?: Date;
  graceEndsAt?: Date;
  suspendedForNonPaymentAt?: Date;
  lastPaidBillingMonth?: string;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    planName: { type: String, required: true, trim: true },
    monthlyPrice: { type: Number, required: true, min: 0 },
    priceType: { type: String, enum: ["Standard", "Negotiated", "Free"], default: "Standard", required: true },
    pricingNote: { type: String, default: "", trim: true },
    billingCycle: {
      type: String,
      enum: ["Monthly", "Quarterly", "Yearly"],
      default: "Monthly",
      required: true,
    },
    status: {
      type: String,
      enum: ["Trial", "Active", "Overdue", "Suspended", "Cancelled"],
      default: "Trial",
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    nextBillingDate: { type: Date },
    graceEndsAt: { type: Date },
    suspendedForNonPaymentAt: { type: Date },
    lastPaidBillingMonth: { type: String, default: "", trim: true },
    features: [{ type: String }],
  },
  { timestamps: true },
);

const Subscription =
  (models.Subscription as Model<SubscriptionDocument>) ||
  model<SubscriptionDocument>("Subscription", subscriptionSchema);

export default Subscription;
