import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { escapeRegex, getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { generateMedicineId, getAvailableStock } from "@/lib/hospital-pharmacy";
import Medicine from "@/models/Medicine";

const medicineSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  category: z.string().optional(),
  dosageForm: z.enum(["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Drops", "Inhaler", "Other"]).optional(),
  strength: z.string().optional(),
  manufacturer: z.string().optional(),
  hsnCode: z.string().optional(),
  unit: z.string().optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "medicines_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["category", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ medicineId: regex }, { name: regex }, { genericName: regex }, { brandName: regex }, { category: regex }];
    }

    await connectDb();
    const docs = await Medicine.find(filter).sort({ name: 1 });
    const enriched = await Promise.all(
      docs.map(async (medicine) => ({
        ...medicine.toObject(),
        availableStock: await getAvailableStock(hospitalId, medicine.medicineId),
      })),
    );
    const lowStock = req.nextUrl.searchParams.get("lowStock") === "true";
    const filtered = lowStock
      ? enriched.filter((medicine) => medicine.availableStock <= medicine.reorderLevel)
      : enriched;
    const paged = filtered.slice(skip, skip + limit);

    return successResponse(serializeDoc(paged), "Medicines fetched", 200, {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "medicines_create");
    const hospitalId = session.payload.hospitalId;
    const body = medicineSchema.parse(await req.json());
    await connectDb();

    const medicine = await Medicine.create({
      ...body,
      hospitalId,
      medicineId: await generateMedicineId(hospitalId),
      dosageForm: body.dosageForm ?? "Other",
      status: body.status ?? "Active",
      createdBy: session.payload.userId,
    });
    return successResponse(serializeDoc(medicine), "Medicine created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
