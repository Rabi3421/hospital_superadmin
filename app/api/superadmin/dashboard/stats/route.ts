import { NextRequest } from "next/server";
import { errorResponse, handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    await connectDb();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const trialExpiryLimit = new Date(now);
    trialExpiryLimit.setDate(trialExpiryLimit.getDate() + 7);
    const [
      totalHospitals,
      activeHospitals,
      trialHospitals,
      suspendedHospitals,
      cancelledHospitals,
      comingSoonWebsites,
      liveWebsites,
      maintenanceWebsites,
      totalPlatformRevenueAgg,
      currentMonthRevenueAgg,
      pendingPlatformPayments,
      overdueSubscriptions,
      newHospitalsThisMonth,
      monthlyRecurringRevenueAgg,
      expiringTrials,
      subscriptionSummaryAgg,
      recentHospitals,
      recentPayments,
    ] = await Promise.all([
      Hospital.countDocuments(),
      Hospital.countDocuments({ status: "Active" }),
      Hospital.countDocuments({ status: "Trial" }),
      Hospital.countDocuments({ status: "Suspended" }),
      Hospital.countDocuments({ status: "Cancelled" }),
      Hospital.countDocuments({ websiteStatus: "Coming Soon" }),
      Hospital.countDocuments({ websiteStatus: "Live" }),
      Hospital.countDocuments({ websiteStatus: "Maintenance" }),
      PlatformPayment.aggregate([
        { $match: { status: "Paid" } },
        { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
      ]),
      PlatformPayment.aggregate([
        { $match: { status: "Paid", paymentDate: { $gte: monthStart, $lt: nextMonthStart } } },
        { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
      ]),
      PlatformPayment.countDocuments({ status: "Pending" }),
      Subscription.countDocuments({ status: "Overdue" }),
      Hospital.countDocuments({ createdAt: { $gte: monthStart } }),
      Subscription.aggregate([
        { $match: { status: "Active" } },
        { $group: { _id: null, monthlyRecurringRevenue: { $sum: "$monthlyPrice" } } },
      ]),
      Hospital.find({
        status: "Trial",
        trialEndDate: { $gte: now, $lte: trialExpiryLimit },
      }).sort({ trialEndDate: 1 }).limit(10).select("hospitalId name status websiteStatus trialEndDate"),
      Subscription.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, monthlyPrice: { $sum: "$monthlyPrice" } } },
      ]),
      Hospital.find().sort({ createdAt: -1 }).limit(5).select("-__v"),
      PlatformPayment.find().sort({ createdAt: -1 }).limit(5).select("-__v"),
    ]);
    const subscriptionSummary = subscriptionSummaryAgg.reduce<Record<string, { count: number; monthlyPrice: number }>>(
      (summary, item) => {
        summary[item._id] = { count: item.count, monthlyPrice: item.monthlyPrice };
        return summary;
      },
      {},
    );

    return successResponse({
      totalHospitals,
      activeHospitals,
      trialHospitals,
      suspendedHospitals,
      cancelledHospitals,
      comingSoonWebsites,
      liveWebsites,
      maintenanceWebsites,
      monthlyRecurringRevenue: monthlyRecurringRevenueAgg[0]?.monthlyRecurringRevenue ?? 0,
      totalPlatformRevenue: totalPlatformRevenueAgg[0]?.totalRevenue ?? 0,
      currentMonthRevenue: currentMonthRevenueAgg[0]?.totalRevenue ?? 0,
      pendingPayments: pendingPlatformPayments,
      pendingPlatformPayments,
      overdueSubscriptions,
      newHospitalsThisMonth,
      expiringTrials,
      subscriptionSummary,
      recentHospitals,
      recentPayments,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
