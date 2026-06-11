import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { getAvailableStock } from "@/lib/hospital-pharmacy";
import Medicine from "@/models/Medicine";

const medicineUpdateSchema = z.object({
  name: z.string().min(1).optional(),
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

type RouteContext = { params: Promise<{ medicineId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "medicines_view");
    const { medicineId } = await context.params;
    await connectDb();
    const medicine = await Medicine.findOne({ hospitalId: session.payload.hospitalId, medicineId });
    if (!medicine) return errorResponse("Medicine not found", 404);
    return successResponse(
      serializeDoc({ ...medicine.toObject(), availableStock: await getAvailableStock(session.payload.hospitalId, medicineId) }),
      "Medicine fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "medicines_update");
    const { medicineId } = await context.params;
    const body = medicineUpdateSchema.parse(await req.json());
    await connectDb();
    const medicine = await Medicine.findOneAndUpdate(
      { hospitalId: session.payload.hospitalId, medicineId },
      { $set: body },
      { new: true },
    );
    if (!medicine) return errorResponse("Medicine not found", 404);
    return successResponse(serializeDoc(medicine), "Medicine updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "medicines_deactivate");
    const { medicineId } = await context.params;
    await connectDb();
    const medicine = await Medicine.findOneAndUpdate(
      { hospitalId: session.payload.hospitalId, medicineId },
      { $set: { status: "Inactive" } },
      { new: true },
    );
    if (!medicine) return errorResponse("Medicine not found", 404);
    return successResponse(serializeDoc(medicine), "Medicine deactivated");
  } catch (error) {
    return handleApiError(error);
  }
}
