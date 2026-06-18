import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Expense from "@/models/Expense";

const expenseUpdateSchema = z.object({
  category: z.enum([
    "Salary", "Rent", "Utilities", "Equipment", "Supplies", "Maintenance",
    "Insurance", "Marketing", "IT", "Pharmacy Stock", "Lab Supplies", "Miscellaneous",
  ]).optional(),
  departmentId: z.string().optional(),
  vendorName: z.string().optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  taxAmount: z.number().min(0).optional(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"]).optional(),
  paymentDate: z.string().optional(),
  transactionId: z.string().optional(),
  status: z.enum(["Pending", "Approved", "Paid", "Rejected"]).optional(),
  recurring: z.boolean().optional(),
  recurringFrequency: z.enum(["Monthly", "Quarterly", "Yearly"]).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ expenseId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "expenses_view");
    const hospitalId = session.payload.hospitalId;
    const { expenseId } = await params;
    await connectDb();

    const expense = await Expense.findOne({ hospitalId, expenseId });
    if (!expense) return errorResponse("Expense not found", 404);

    return successResponse(serializeDoc(expense), "Expense details");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ expenseId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "expenses_update");
    const hospitalId = session.payload.hospitalId;
    const { expenseId } = await params;
    const body = expenseUpdateSchema.parse(await req.json());
    await connectDb();

    const expense = await Expense.findOne({ hospitalId, expenseId });
    if (!expense) return errorResponse("Expense not found", 404);
    if (expense.status === "Rejected") return errorResponse("Cannot update rejected expenses", 400);

    if (body.status === "Approved") expense.approvedBy = session.payload.userId;

    const fields = [
      "category", "departmentId", "vendorName", "description", "paymentMode",
      "transactionId", "status", "recurring", "recurringFrequency", "notes",
    ] as const;
    fields.forEach((key) => {
      if (body[key] !== undefined) (expense as Record<string, unknown>)[key] = body[key];
    });

    if (body.paymentDate) expense.paymentDate = new Date(body.paymentDate);

    if (body.amount !== undefined || body.taxAmount !== undefined) {
      const amount = Math.round(((body.amount ?? expense.amount) + Number.EPSILON) * 100) / 100;
      const taxAmount = Math.round(((body.taxAmount ?? expense.taxAmount) + Number.EPSILON) * 100) / 100;
      expense.amount = amount;
      expense.taxAmount = taxAmount;
      expense.totalAmount = Math.round((amount + taxAmount + Number.EPSILON) * 100) / 100;
    }

    await expense.save();
    return successResponse(serializeDoc(expense), "Expense updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ expenseId: string }> }) {
  try {
    const session = await requireHospitalPermission(req, "expenses_update");
    const hospitalId = session.payload.hospitalId;
    const { expenseId } = await params;
    await connectDb();

    const expense = await Expense.findOne({ hospitalId, expenseId });
    if (!expense) return errorResponse("Expense not found", 404);
    if (expense.status === "Paid") return errorResponse("Cannot delete paid expenses", 400);

    if (expense.status === "Pending") {
      await expense.deleteOne();
      return successResponse(null, "Expense deleted");
    }

    expense.status = "Rejected";
    await expense.save();
    return successResponse(serializeDoc(expense), "Expense rejected");
  } catch (error) {
    return handleApiError(error);
  }
}
