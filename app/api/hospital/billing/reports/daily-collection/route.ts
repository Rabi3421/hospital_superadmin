import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor, endOfDay, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import BillPayment from "@/models/BillPayment";
import HospitalUser from "@/models/HospitalUser";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "daily_collection_view");
    const hospitalId = session.payload.hospitalId;
    const fromDate = req.nextUrl.searchParams.get("fromDate");
    const toDate = req.nextUrl.searchParams.get("toDate");
    const paymentDate =
      fromDate || toDate
        ? {
            ...(fromDate ? { $gte: startOfDay(new Date(fromDate)) } : {}),
            ...(toDate ? { $lte: endOfDay(new Date(toDate)) } : {}),
          }
        : dateRangeFor(req.nextUrl.searchParams.get("date") ?? new Date());
    const filter: Record<string, unknown> = { hospitalId, paymentDate, status: "Success" };
    const paymentMode = req.nextUrl.searchParams.get("paymentMode")?.trim();
    if (paymentMode) filter.paymentMode = paymentMode;
    await connectDb();

    const payments = await BillPayment.find(filter).sort({
      paymentDate: -1,
      createdAt: -1,
    });
    const totalCollected = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const byPaymentMode = payments.reduce<Record<string, number>>((summary, payment) => {
      summary[payment.paymentMode] = (summary[payment.paymentMode] ?? 0) + payment.amount;
      return summary;
    }, {});
    const receivedByIds = [
      ...new Set(
        payments
          .map((payment) => payment.receivedBy)
          .filter((receivedBy): receivedBy is string => Boolean(receivedBy)),
      ),
    ];
    const users = await HospitalUser.find({ hospitalId, _id: { $in: receivedByIds } }).select("name email role");
    const userById = new Map(users.map((user) => [user._id.toString(), user]));
    const receivedBySummary = payments.reduce<Record<string, { amount: number; count: number; user: unknown }>>(
      (summary, payment) => {
        const key = payment.receivedBy || "unknown";
        summary[key] = summary[key] ?? { amount: 0, count: 0, user: userById.get(key) ?? null };
        summary[key].amount += payment.amount;
        summary[key].count += 1;
        return summary;
      },
      {},
    );

    return successResponse(
      serializeDoc({
        totalCollected,
        byPaymentMode,
        paymentCount: payments.length,
        payments,
        receivedBySummary,
      }),
      "Daily collection report fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
