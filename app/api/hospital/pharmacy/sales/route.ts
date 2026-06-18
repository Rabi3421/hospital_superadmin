import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor, endOfDay, escapeRegex, getPagination, startOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { sendEventNotification } from "@/lib/notifications/notification-service";
import {
  allocateStockFIFO,
  calculateSaleTotals,
  createStockMovement,
  generatePharmacySaleId,
  updateBatchStatusIfNeeded,
  validateSaleItems,
} from "@/lib/hospital-pharmacy";
import Medicine from "@/models/Medicine";
import MedicineBatch from "@/models/MedicineBatch";
import Bill from "@/models/Bill";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";
import StockMovement from "@/models/StockMovement";

const saleItemSchema = z.object({
  medicineId: z.string().min(1),
  batchId: z.string().optional().or(z.literal("")),
  quantity: z.number().positive(),
});

const saleCreateSchema = z.object({
  patientId: z.string().min(1).optional(),
  prescriptionId: z.string().optional().or(z.literal("")),
  items: z.array(saleItemSchema).min(1),
  discountType: z.enum(["None", "Flat", "Percentage"]).optional(),
  discountValue: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Other"]).optional(),
  notes: z.string().optional(),
});

function dateBetween(searchParams: URLSearchParams) {
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  if (dateFrom && dateTo) return { $gte: startOfDay(new Date(dateFrom)), $lte: endOfDay(new Date(dateTo)) };
  if (dateFrom) return { $gte: startOfDay(new Date(dateFrom)) };
  if (dateTo) return { $lte: endOfDay(new Date(dateTo)) };
  return null;
}

function paymentStatus(grandTotal: number, paidAmount: number) {
  if (paidAmount <= 0) return "Unpaid";
  if (paidAmount < grandTotal) return "Partially Paid";
  return "Paid";
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "pharmacy_sales_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };
    ["patientId", "prescriptionId", "saleStatus", "paymentStatus"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    const status = req.nextUrl.searchParams.get("status")?.trim();
    if (status) filter.saleStatus = status;
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ saleId: regex }, { patientId: regex }, { prescriptionId: regex }];
    }
    const createdAt = dateBetween(req.nextUrl.searchParams);
    const date = req.nextUrl.searchParams.get("date");
    if (date) filter.createdAt = dateRangeFor(date);
    else if (createdAt) filter.createdAt = createdAt;
    await connectDb();
    const [sales, total] = await Promise.all([
      PharmacySale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      PharmacySale.countDocuments(filter),
    ]);
    const patientIds = [...new Set(sales.map((sale) => sale.patientId))];
    const prescriptionIds = [...new Set(sales.map((sale) => sale.prescriptionId).filter((id): id is string => Boolean(id)))];
    const saleIds = sales.map((sale) => sale.saleId);
    const [patients, prescriptions, bills] = await Promise.all([
      Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone gender age status"),
      Prescription.find({ hospitalId, prescriptionId: { $in: prescriptionIds } }).select(
        "prescriptionId status issuedAt doctorUserId consultationId appointmentId",
      ),
      Bill.find({ hospitalId, sourceType: "PharmacySale", sourceId: { $in: saleIds } }).select("billId sourceId status grandTotal dueAmount"),
    ]);
    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const prescriptionById = new Map(prescriptions.map((prescription) => [prescription.prescriptionId, prescription]));
    const billBySaleId = new Map(bills.map((bill) => [bill.sourceId, bill]));
    const enrichedSales = sales.map((sale) => ({
      ...sale.toObject(),
      totalAmount: sale.grandTotal,
      patient: patientById.get(sale.patientId) ?? null,
      prescription: sale.prescriptionId ? prescriptionById.get(sale.prescriptionId) ?? null : null,
      bill: billBySaleId.get(sale.saleId) ?? null,
    }));
    return successResponse(serializeDoc(enrichedSales), "Pharmacy sales fetched", 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "pharmacy_sales_create");
    const hospitalId = session.payload.hospitalId;
    const body = saleCreateSchema.parse(await req.json());
    await connectDb();
    const duplicateMedicineIds = body.items
      .map((item) => item.medicineId)
      .filter((medicineId, index, values) => values.indexOf(medicineId) !== index);
    if (duplicateMedicineIds.length) return errorResponse("Combine duplicate medicine items into one quantity", 409);

    const prescription = body.prescriptionId ? await Prescription.findOne({ hospitalId, prescriptionId: body.prescriptionId }) : null;
    if (body.prescriptionId && !prescription) return errorResponse("Prescription not found", 404);
    if (prescription?.status !== "Issued") return errorResponse("Only issued prescriptions can be dispensed", 409);
    const patientId = prescription?.patientId ?? body.patientId;
    if (!patientId) return errorResponse("Patient ID is required for a manual pharmacy sale", 400);
    if (prescription && body.patientId && body.patientId !== prescription.patientId) {
      return errorResponse("Prescription patient does not match pharmacy sale", 409);
    }
    if (prescription) {
      const existingSale = await PharmacySale.findOne({
        hospitalId,
        prescriptionId: prescription.prescriptionId,
        saleStatus: "Completed",
      });
      if (existingSale) return successResponse(serializeDoc(existingSale), "Prescription already dispensed");
    }
    const patient = await Patient.findOne({ hospitalId, patientId });
    if (!patient) return errorResponse("Patient not found", 404);
    await validateSaleItems(hospitalId, body.items);

    const saleItems = [];
    for (const item of body.items) {
      const medicine = await Medicine.findOne({ hospitalId, medicineId: item.medicineId, status: "Active" });
      if (!medicine) return errorResponse("Medicine not found or inactive", 404);
      const allocations = await allocateStockFIFO(hospitalId, item.medicineId, item.quantity, item.batchId || undefined);
      for (const allocation of allocations) {
        saleItems.push({
          medicineId: item.medicineId,
          batchId: allocation.batchId,
          medicineName: medicine.name,
          batchNumber: allocation.batchNumber,
          quantity: allocation.quantity,
          unitPrice: allocation.unitPrice,
          total: Math.round(allocation.quantity * allocation.unitPrice * 100) / 100,
        });
      }
    }

    const totals = calculateSaleTotals(saleItems, body.discountType ?? "None", body.discountValue ?? 0, body.taxAmount ?? 0);
    const paidAmount = Math.min(body.paidAmount ?? totals.grandTotal, totals.grandTotal);
    const sale = await PharmacySale.create({
      hospitalId,
      saleId: await generatePharmacySaleId(hospitalId),
      patientId,
      prescriptionId: body.prescriptionId ?? "",
      appointmentId: prescription?.appointmentId ?? "",
      consultationId: prescription?.consultationId ?? "",
      items: saleItems,
      ...totals,
      paidAmount,
      dueAmount: Math.max(totals.grandTotal - paidAmount, 0),
      paymentMode: body.paymentMode ?? "Cash",
      paymentStatus: paymentStatus(totals.grandTotal, paidAmount),
      saleStatus: "Completed",
      notes: body.notes ?? "",
      soldBy: session.payload.userId,
    });

    const applied: { batchId: string; quantity: number }[] = [];
    try {
      for (const item of saleItems) {
        const batch = await MedicineBatch.findOne({ hospitalId, batchId: item.batchId });
        if (!batch || batch.quantityAvailable < item.quantity) throw new Error("Insufficient medicine stock");
        const previousQuantity = batch.quantityAvailable;
        batch.quantityAvailable = previousQuantity - item.quantity;
        await batch.save();
        applied.push({ batchId: batch.batchId, quantity: item.quantity });
        await createStockMovement({
          hospitalId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          type: "Sale",
          quantity: -item.quantity,
          previousQuantity,
          newQuantity: batch.quantityAvailable,
          reason: "Pharmacy sale",
          referenceType: "Sale",
          referenceId: sale.saleId,
          createdBy: session.payload.userId,
        });
        await updateBatchStatusIfNeeded(item.batchId, hospitalId);
      }
    } catch (error) {
      await Promise.all(
        applied.map(({ batchId, quantity }) =>
          MedicineBatch.updateOne({ hospitalId, batchId }, { $inc: { quantityAvailable: quantity }, $set: { status: "Active" } }),
        ),
      );
      await Promise.all([
        StockMovement.deleteMany({ hospitalId, referenceType: "Sale", referenceId: sale.saleId }),
        PharmacySale.deleteOne({ hospitalId, saleId: sale.saleId }),
      ]);
      throw error;
    }

    // Fire-and-forget notification
    try {
      if (patient?.phone) {
        void sendEventNotification({
          hospitalId,
          eventType: "PHARMACY_SALE_COMPLETED",
          recipient: {
            type: "PATIENT",
            name: patient.name,
            phone: patient.phone,
            patientId: sale.patientId,
          },
          context: {
            patientName: patient.name,
            hospitalName: session.hospital.name,
          },
          relatedIds: { pharmacySaleId: sale.saleId },
        }).catch(() => {});
      }
    } catch {}

    return successResponse(serializeDoc(sale), "Pharmacy sale created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
