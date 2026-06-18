import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { generateExpenseId } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Expense from "@/models/Expense";

const expenseCategories = [
  "Salary", "Rent", "Utilities", "Equipment", "Supplies", "Maintenance",
  "Insurance", "Marketing", "IT", "Pharmacy Stock", "Lab Supplies", "Miscellaneous",
] as const;

const expenseCreateSchema = z.object({
  category: z.enum(expenseCategories),
  departmentId: z.string().optional(),
  vendorName: z.string().optional(),
  description: z.string().min(1),
  amount: z.number().positive(),
  taxAmount: z.number().min(0).optional(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"]),
  paymentDate: z.string().min(1),
  transactionId: z.string().optional(),
  status: z.enum(["Pending", "Approved", "Paid"]).optional(),
  recurring: z.boolean().optional(),
  recurringFrequency: z.enum(["Monthly", "Quarterly", "Yearly"]).optional(),
  notes: z.string().optional(),
});

function dateBetween(searchParams: URLSearchParams) {
  const dateFrom = searchParams.get("fromDate") ?? searchParams.get("dateFrom");
  const dateTo = searchParams.get("toDate") ?? searchParams.get("dateTo");
  if (dateFrom && dateTo) return { $gte: startOfDay(new Date(dateFrom)), $lte: endOfDay(new Date(dateTo)) };
  if (dateFrom) return { $gte: startOfDay(new Date(dateFrom)) };
  if (dateTo) return { $lte: endOfDay(new Date(dateTo)) };
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "expenses_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["category", "departmentId", "status", "paymentMode"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });

    const recurring = req.nextUrl.searchParams.get("recurring");
    if (recurring === "true") filter.recurring = true;
    if (recurring === "false") filter.recurring = false;

    const paymentDate = dateBetween(req.nextUrl.searchParams);
    if (paymentDate) filter.paymentDate = paymentDate;

    await connectDb();
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ expenseId: regex }, { description: regex }, { vendorName: regex }];
    }

    const [expenses, total] = await Promise.all([
      Expense.find(filter).sort({ paymentDate: -1 }).skip(skip).limit(limit),
      Expense.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(expenses), "Expenses fetched", 200, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "expenses_create");
    const hospitalId = session.payload.hospitalId;
    const body = expenseCreateSchema.parse(await req.json());
    await connectDb();

    const amount = Math.round((body.amount + Number.EPSILON) * 100) / 100;
    const taxAmount = Math.round(((body.taxAmount ?? 0) + Number.EPSILON) * 100) / 100;
    const totalAmount = Math.round((amount + taxAmount + Number.EPSILON) * 100) / 100;

    const expense = await Expense.create({
      hospitalId,
      expenseId: await generateExpenseId(hospitalId),
      category: body.category,
      departmentId: body.departmentId ?? "",
      vendorName: body.vendorName ?? "",
      description: body.description,
      amount,
      taxAmount,
      totalAmount,
      paymentMode: body.paymentMode,
      paymentDate: new Date(body.paymentDate),
      transactionId: body.transactionId ?? "",
      status: body.status ?? "Pending",
      recurring: body.recurring ?? false,
      recurringFrequency: body.recurring ? body.recurringFrequency : undefined,
      notes: body.notes ?? "",
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(expense), "Expense created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
