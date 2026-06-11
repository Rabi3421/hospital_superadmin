import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Bill from "@/models/Bill";
import Patient from "@/models/Patient";

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
    const session = await requireHospitalPermission(req, "dues_report_view");
    const hospitalId = session.payload.hospitalId;
    const filter: Record<string, unknown> = {
      hospitalId,
      status: { $in: ["Unpaid", "Partially Paid"] },
    };
    const patientId = req.nextUrl.searchParams.get("patientId")?.trim();
    if (patientId) filter.patientId = patientId;
    const status = req.nextUrl.searchParams.get("status")?.trim();
    if (status && ["Unpaid", "Partially Paid"].includes(status)) filter.status = status;
    const createdAt = dateBetween(req.nextUrl.searchParams);
    if (createdAt) filter.createdAt = createdAt;

    await connectDb();
    const bills = await Bill.find(filter).sort({ createdAt: -1 });
    const totalDue = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);
    const patients = await Patient.find({ hospitalId, patientId: { $in: bills.map((bill) => bill.patientId) } }).select(
      "patientId name phone gender age",
    );
    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const enrichedBills = bills.map((bill) => ({
      ...bill.toObject(),
      totalAmount: bill.grandTotal,
      patient: patientById.get(bill.patientId) ?? null,
    }));

    return successResponse(serializeDoc({ totalDue, bills: enrichedBills }), "Dues report fetched");
  } catch (error) {
    return handleApiError(error);
  }
}
