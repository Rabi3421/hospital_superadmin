import { NextRequest } from "next/server";
import { handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";

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
    const session = await requireHospitalPermission(req, "billing_summary_view");
    const hospitalId = session.payload.hospitalId;
    const createdAt = dateBetween(req.nextUrl.searchParams);
    const billFilter: Record<string, unknown> = { hospitalId };
    const paymentFilter: Record<string, unknown> = { hospitalId, status: "Success" };
    if (createdAt) {
      billFilter.createdAt = createdAt;
      paymentFilter.paymentDate = createdAt;
    }

    await connectDb();
    const [bills, payments] = await Promise.all([
      Bill.find(billFilter).select("billId patientId sourceType grandTotal paidAmount dueAmount status createdAt"),
      BillPayment.find(paymentFilter).select("paymentId billId patientId amount paymentMode paymentDate"),
    ]);

    const activeBills = bills.filter((bill) => bill.status !== "Cancelled");
    const totalBilled = activeBills.reduce((sum, bill) => sum + bill.grandTotal, 0);
    const totalCollected = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalDue = activeBills.reduce((sum, bill) => sum + bill.dueAmount, 0);
    const billsByStatus = bills.reduce<Record<string, { count: number; total: number; due: number }>>((summary, bill) => {
      summary[bill.status] = summary[bill.status] ?? { count: 0, total: 0, due: 0 };
      summary[bill.status].count += 1;
      summary[bill.status].total += bill.grandTotal;
      summary[bill.status].due += bill.dueAmount;
      return summary;
    }, {});
    const paymentsByMode = payments.reduce<Record<string, { count: number; total: number }>>((summary, payment) => {
      summary[payment.paymentMode] = summary[payment.paymentMode] ?? { count: 0, total: 0 };
      summary[payment.paymentMode].count += 1;
      summary[payment.paymentMode].total += payment.amount;
      return summary;
    }, {});
    const revenueBySourceType = activeBills.reduce<Record<string, { count: number; total: number }>>((summary, bill) => {
      summary[bill.sourceType] = summary[bill.sourceType] ?? { count: 0, total: 0 };
      summary[bill.sourceType].count += 1;
      summary[bill.sourceType].total += bill.grandTotal;
      return summary;
    }, {});

    return successResponse({
      totalBilled,
      totalCollected,
      totalDue,
      billCount: bills.length,
      paidBillCount: bills.filter((bill) => bill.status === "Paid").length,
      unpaidBillCount: bills.filter((bill) => bill.status === "Unpaid").length,
      partiallyPaidBillCount: bills.filter((bill) => bill.status === "Partially Paid").length,
      cancelledBillCount: bills.filter((bill) => bill.status === "Cancelled").length,
      billsByStatus,
      paymentsByMode,
      revenueBySourceType,
      recentPayments: payments
        .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())
        .slice(0, 10),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
