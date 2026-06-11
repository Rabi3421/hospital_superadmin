import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { createStockMovement, generateMedicineBatchId } from "@/lib/hospital-pharmacy";
import Medicine from "@/models/Medicine";
import MedicineBatch from "@/models/MedicineBatch";

const stockAddSchema = z.object({
  medicineId: z.string().min(1),
  batchNumber: z.string().min(1),
  expiryDate: z.coerce.date(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  quantityReceived: z.number().positive(),
  supplierName: z.string().optional(),
  receivedDate: z.coerce.date().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "medicine_stock_add");
    const hospitalId = session.payload.hospitalId;
    const body = stockAddSchema.parse(await req.json());
    await connectDb();
    const medicine = await Medicine.findOne({ hospitalId, medicineId: body.medicineId, status: "Active" });
    if (!medicine) return errorResponse("Medicine not found or inactive", 404);
    if (body.expiryDate <= new Date()) return errorResponse("Expiry date must be in the future", 422);

    const batch = await MedicineBatch.create({
      ...body,
      hospitalId,
      batchId: await generateMedicineBatchId(hospitalId),
      quantityAvailable: body.quantityReceived,
      receivedDate: body.receivedDate ?? new Date(),
      status: "Active",
      createdBy: session.payload.userId,
    });
    await createStockMovement({
      hospitalId,
      medicineId: batch.medicineId,
      batchId: batch.batchId,
      type: "Stock In",
      quantity: batch.quantityReceived,
      previousQuantity: 0,
      newQuantity: batch.quantityAvailable,
      reason: "Stock added",
      referenceType: "Batch",
      referenceId: batch.batchId,
      createdBy: session.payload.userId,
    });
    return successResponse(serializeDoc(batch), "Medicine stock added", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
