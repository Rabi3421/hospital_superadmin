import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import BillPayment from "@/models/BillPayment";
import Expense from "@/models/Expense";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "billing_reports_view");
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const dateFrom = req.nextUrl.searchParams.get("fromDate");
    const dateTo = req.nextUrl.searchParams.get("toDate");

    const dateFilter: Record<string, unknown> = {};
    if (dateFrom) dateFilter.$gte = startOfDay(new Date(dateFrom));
    if (dateTo) dateFilter.$lte = endOfDay(new Date(dateTo));
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const paymentFilter: Record<string, unknown> = { hospitalId, status: "Success" };
    if (hasDateFilter) paymentFilter.paymentDate = dateFilter;

    const expenseFilter: Record<string, unknown> = { hospitalId, status: { $in: ["Paid", "Approved"] } };
    if (hasDateFilter) expenseFilter.paymentDate = dateFilter;

    const [payments, expenses] = await Promise.all([
      BillPayment.find(paymentFilter).lean(),
      Expense.find(expenseFilter).lean(),
    ]);

    const totalIncome = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.totalAmount, 0);
    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 10000) / 100 : 0;

    const incomeByMode: Record<string, number> = {};
    for (const p of payments) {
      incomeByMode[p.paymentMode] = (incomeByMode[p.paymentMode] ?? 0) + p.amount;
    }

    const expenseByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.totalAmount;
    }

    // Monthly trend
    const trendMap: Record<string, { income: number; expense: number }> = {};
    for (const p of payments) {
      const d = new Date(p.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!trendMap[key]) trendMap[key] = { income: 0, expense: 0 };
      trendMap[key].income += p.amount;
    }
    for (const e of expenses) {
      const d = new Date(e.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!trendMap[key]) trendMap[key] = { income: 0, expense: 0 };
      trendMap[key].expense += e.totalAmount;
    }
    const trend = Object.entries(trendMap)
      .map(([month, data]) => ({ month, ...data, net: data.income - data.expense }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return successResponse(serializeDoc({
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin,
      incomeByMode,
      expenseByCategory,
      trend,
      paymentCount: payments.length,
      expenseCount: expenses.length,
    }), "Income vs Expense report");
  } catch (error) {
    return handleApiError(error);
  }
}
