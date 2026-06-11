import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { createStockMovement, updateBatchStatusIfNeeded } from "@/lib/hospital-pharmacy";
import MedicineBatch from "@/models/MedicineBatch";

const adjustSchema = z.object({
  batchId: z.string().min(1),
  quantityChange: z.number().refine((value) => value !== 0, "Quantity change cannot be zero"),
  reason: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "medicine_stock_adjust");
    const hospitalId = session.payload.hospitalId;
    const body = adjustSchema.parse(await req.json());
    await connectDb();
    const batch = await MedicineBatch.findOne({ hospitalId, batchId: body.batchId });
    if (!batch) return errorResponse("Medicine batch not found", 404);
    const previousQuantity = batch.quantityAvailable;
    const newQuantity = previousQuantity + body.quantityChange;
    if (newQuantity < 0) return errorResponse("Stock adjustment cannot reduce quantity below zero", 409);
    batch.quantityAvailable = newQuantity;
    await batch.save();
    await updateBatchStatusIfNeeded(batch.batchId, hospitalId);
    await createStockMovement({
      hospitalId,
      medicineId: batch.medicineId,
      batchId: batch.batchId,
      type: "Adjustment",
      quantity: body.quantityChange,
      previousQuantity,
      newQuantity,
      reason: body.reason,
      referenceType: "Manual",
      createdBy: session.payload.userId,
    });
    return successResponse(serializeDoc(batch), "Medicine stock adjusted");
  } catch (error) {
    return handleApiError(error);
  }
}
