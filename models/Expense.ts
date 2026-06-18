import { Document, Model, Schema, model, models } from "mongoose";

export interface ExpenseDocument extends Document {
  hospitalId: string;
  expenseId: string;
  category:
    | "Salary"
    | "Rent"
    | "Utilities"
    | "Equipment"
    | "Supplies"
    | "Maintenance"
    | "Insurance"
    | "Marketing"
    | "IT"
    | "Pharmacy Stock"
    | "Lab Supplies"
    | "Miscellaneous";
  departmentId?: string;
  vendorName?: string;
  description: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMode: "Cash" | "UPI" | "Card" | "Bank Transfer" | "Cheque" | "Other";
  paymentDate: Date;
  transactionId?: string;
  status: "Pending" | "Approved" | "Paid" | "Rejected";
  approvedBy?: string;
  recurring: boolean;
  recurringFrequency?: "Monthly" | "Quarterly" | "Yearly";
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<ExpenseDocument>(
  {
    hospitalId: { type: String, required: true, index: true },
    expenseId: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "Salary",
        "Rent",
        "Utilities",
        "Equipment",
        "Supplies",
        "Maintenance",
        "Insurance",
        "Marketing",
        "IT",
        "Pharmacy Stock",
        "Lab Supplies",
        "Miscellaneous",
      ],
      required: true,
    },
    departmentId: { type: String, default: "", trim: true },
    vendorName: { type: String, default: "", trim: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"],
      required: true,
    },
    paymentDate: { type: Date, required: true },
    transactionId: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Paid", "Rejected"],
      default: "Pending",
      required: true,
    },
    approvedBy: { type: String, default: "" },
    recurring: { type: Boolean, default: false },
    recurringFrequency: {
      type: String,
      enum: ["Monthly", "Quarterly", "Yearly"],
    },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

expenseSchema.index({ hospitalId: 1, expenseId: 1 }, { unique: true });
expenseSchema.index({ hospitalId: 1, category: 1 });
expenseSchema.index({ hospitalId: 1, departmentId: 1 });
expenseSchema.index({ hospitalId: 1, paymentDate: 1 });
expenseSchema.index({ hospitalId: 1, status: 1 });
expenseSchema.index({ hospitalId: 1, createdAt: 1 });

const Expense = (models.Expense as Model<ExpenseDocument>) || model<ExpenseDocument>("Expense", expenseSchema);

export default Expense;
