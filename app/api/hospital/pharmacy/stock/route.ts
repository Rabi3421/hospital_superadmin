import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { endOfDay, escapeRegex, getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Medicine from "@/models/Medicine";
import MedicineBatch from "@/models/MedicineBatch";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "medicine_stock_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };
    await connectDb();
    const medicineId = req.nextUrl.searchParams.get("medicineId")?.trim();
    if (medicineId) filter.medicineId = medicineId;
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const matchingMedicines = await Medicine.find({
        hospitalId,
        $or: [{ medicineId: regex }, { name: regex }, { genericName: regex }, { brandName: regex }],
      }).select("medicineId");
      filter.medicineId = { $in: matchingMedicines.map((medicine) => medicine.medicineId) };
    }
    const expiryBefore = req.nextUrl.searchParams.get("expiryBefore");
    if (expiryBefore) filter.expiryDate = { $lte: endOfDay(new Date(expiryBefore)) };
    if (req.nextUrl.searchParams.get("expiringSoon") === "true") {
      filter.expiryDate = { $gte: new Date(), $lte: endOfDay(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) };
    }
    if (req.nextUrl.searchParams.get("expired") === "true") filter.expiryDate = { $lt: new Date() };

    const batches = await MedicineBatch.find(filter).sort({ expiryDate: 1 }).skip(skip).limit(limit);
    const total = await MedicineBatch.countDocuments(filter);
    const medicines = await Medicine.find({ hospitalId, medicineId: { $in: batches.map((batch) => batch.medicineId) } }).select(
      "medicineId name genericName brandName reorderLevel status",
    );
    const medicineById = new Map(medicines.map((medicine) => [medicine.medicineId, medicine]));
    const stock = batches.map((batch) => ({ ...batch.toObject(), medicine: medicineById.get(batch.medicineId) ?? null }));
    const lowStock = req.nextUrl.searchParams.get("lowStock") === "true";
    const filtered = lowStock
      ? stock.filter((entry) => entry.quantityAvailable <= Number(entry.medicine?.reorderLevel ?? 0))
      : stock;

    return successResponse(serializeDoc(filtered), "Medicine stock fetched", 200, {
      page,
      limit,
      total: lowStock ? filtered.length : total,
      totalPages: Math.ceil((lowStock ? filtered.length : total) / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
