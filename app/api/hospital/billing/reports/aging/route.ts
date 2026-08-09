import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "dues_report_view");
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const asOfDateParam = req.nextUrl.searchParams.get("asOfDate");
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date();

    const bills = await Bill.find({
      hospitalId,
      status: { $in: ["Unpaid", "Partially Paid"] },
    })
      .sort({ createdAt: 1 })
      .lean();

    const buckets = [
      { range: "0-30", min: 0, max: 30, billCount: 0, totalDue: 0 },
      { range: "31-60", min: 31, max: 60, billCount: 0, totalDue: 0 },
      { range: "61-90", min: 61, max: 90, billCount: 0, totalDue: 0 },
      { range: "90+", min: 91, max: Infinity, billCount: 0, totalDue: 0 },
    ];

    const patientIds = [...new Set(bills.map((b) => b.patientId))];
    const patients = await Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone").lean();
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));

    let totalDue = 0;
    let totalDaysWeighted = 0;

    const billDetails = bills.map((bill) => {
      const patient = patientMap.get(bill.patientId);
      const daysPastDue = Math.floor((asOfDate.getTime() - new Date(bill.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const bucket = buckets.find((b) => daysPastDue >= b.min && daysPastDue <= b.max) ?? buckets[3];
      bucket.billCount++;
      bucket.totalDue += bill.dueAmount;
      totalDue += bill.dueAmount;
      totalDaysWeighted += daysPastDue * bill.dueAmount;

      return {
        billId: bill.billId,
        patientId: bill.patientId,
        patientName: patient?.name ?? "Unknown",
        patientPhone: patient?.phone ?? "",
        grandTotal: bill.grandTotal,
        paidAmount: bill.paidAmount,
        dueAmount: bill.dueAmount,
        status: bill.status,
        daysPastDue,
        bucket: bucket.range,
        createdAt: bill.createdAt,
      };
    });

    billDetails.sort((a, b) => b.daysPastDue - a.daysPastDue);

    return successResponse(serializeDoc({
      asOfDate,
      totalDue,
      totalBills: bills.length,
      averageDaysPastDue: totalDue > 0 ? Math.round(totalDaysWeighted / totalDue) : 0,
      buckets,
      bills: billDetails,
    }), "Aging report");
  } catch (error) {
    return handleApiError(error);
  }
}
