import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalUser from "@/models/HospitalUser";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "revenue_analytics_view");
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const groupBy = req.nextUrl.searchParams.get("groupBy") ?? "month";
    const dateFrom = req.nextUrl.searchParams.get("fromDate");
    const dateTo = req.nextUrl.searchParams.get("toDate");

    const filter: Record<string, unknown> = {
      hospitalId,
      status: { $ne: "Cancelled" },
    };
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) (filter.createdAt as Record<string, unknown>).$gte = startOfDay(new Date(dateFrom));
      if (dateTo) (filter.createdAt as Record<string, unknown>).$lte = endOfDay(new Date(dateTo));
    }

    const bills = await Bill.find(filter).lean();

    const totalRevenue = bills.reduce((s, b) => s + b.grandTotal, 0);
    const totalCollected = bills.reduce((s, b) => s + b.paidAmount, 0);
    const totalDue = bills.reduce((s, b) => s + b.dueAmount, 0);

    if (groupBy === "doctor") {
      const doctorIds = [
        ...new Set(bills.map((b) => b.doctorUserId).filter((id): id is string => Boolean(id))),
      ];
      const doctors = await HospitalUser.find({ hospitalId, _id: { $in: doctorIds } }).select("name role").lean();
      const doctorMap = new Map(doctors.map((d) => [String(d._id), d]));

      const byDoctor: Record<string, { doctorName: string; billCount: number; totalRevenue: number; paidAmount: number; dueAmount: number }> = {};
      for (const bill of bills) {
        const key = bill.doctorUserId || "unassigned";
        if (!byDoctor[key]) {
          const doc = doctorMap.get(key);
          byDoctor[key] = { doctorName: doc?.name ?? "Unassigned", billCount: 0, totalRevenue: 0, paidAmount: 0, dueAmount: 0 };
        }
        byDoctor[key].billCount++;
        byDoctor[key].totalRevenue += bill.grandTotal;
        byDoctor[key].paidAmount += bill.paidAmount;
        byDoctor[key].dueAmount += bill.dueAmount;
      }
      return successResponse(serializeDoc({
        groupBy, totalRevenue, totalCollected, totalDue,
        doctors: Object.entries(byDoctor).map(([id, data]) => ({ doctorUserId: id, ...data })),
      }), "Revenue by doctor");
    }

    if (groupBy === "department") {
      const doctorIds = [
        ...new Set(bills.map((b) => b.doctorUserId).filter((id): id is string => Boolean(id))),
      ];
      const doctors = await HospitalUser.find({ hospitalId, _id: { $in: doctorIds } })
        .select("name departmentId")
        .lean<Array<{ _id: unknown; name: string; departmentId?: string }>>();
      const doctorMap = new Map(doctors.map((d) => [String(d._id), d]));
      const deptIds = [
        ...new Set(doctors.map((d) => d.departmentId).filter((id): id is string => Boolean(id))),
      ];
      const departments = await HospitalDepartment.find({ hospitalId, _id: { $in: deptIds } }).select("name").lean();
      const deptMap = new Map(departments.map((d) => [String(d._id), d.name]));

      const byDept: Record<string, { departmentName: string; billCount: number; totalRevenue: number; paidAmount: number; dueAmount: number }> = {};
      for (const bill of bills) {
        const doc = bill.doctorUserId ? doctorMap.get(bill.doctorUserId) : null;
        const deptId = doc?.departmentId ?? "";
        const key = deptId || "unassigned";
        if (!byDept[key]) byDept[key] = { departmentName: deptMap.get(key) ?? "Unassigned", billCount: 0, totalRevenue: 0, paidAmount: 0, dueAmount: 0 };
        byDept[key].billCount++;
        byDept[key].totalRevenue += bill.grandTotal;
        byDept[key].paidAmount += bill.paidAmount;
        byDept[key].dueAmount += bill.dueAmount;
      }
      return successResponse(serializeDoc({
        groupBy, totalRevenue, totalCollected, totalDue,
        departments: Object.entries(byDept).map(([id, data]) => ({ departmentId: id, ...data })),
      }), "Revenue by department");
    }

    // Default: group by month
    const byMonth: Record<string, { billCount: number; totalRevenue: number; totalCollected: number; totalDue: number }> = {};
    for (const bill of bills) {
      const date = new Date(bill.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[key]) byMonth[key] = { billCount: 0, totalRevenue: 0, totalCollected: 0, totalDue: 0 };
      byMonth[key].billCount++;
      byMonth[key].totalRevenue += bill.grandTotal;
      byMonth[key].totalCollected += bill.paidAmount;
      byMonth[key].totalDue += bill.dueAmount;
    }
    const months = Object.entries(byMonth)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return successResponse(serializeDoc({ groupBy, totalRevenue, totalCollected, totalDue, months }), "Revenue by month");
  } catch (error) {
    return handleApiError(error);
  }
}
