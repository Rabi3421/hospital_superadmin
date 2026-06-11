import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { createStockMovement, updateBatchStatusIfNeeded } from "@/lib/hospital-pharmacy";
import Bill from "@/models/Bill";
import MedicineBatch from "@/models/MedicineBatch";
import PharmacySale from "@/models/PharmacySale";

const cancelSchema = z.object({ cancellationReason: z.string().optional() });
type RouteContext = { params: Promise<{ saleId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "pharmacy_sales_cancel");
    const hospitalId = session.payload.hospitalId;
    const { saleId } = await context.params;
    const body = cancelSchema.parse(await req.json().catch(() => ({})));
    await connectDb();
    const sale = await PharmacySale.findOne({ hospitalId, saleId });
    if (!sale) return errorResponse("Pharmacy sale not found", 404);
    if (sale.saleStatus !== "Completed") return errorResponse("Only completed sales can be cancelled", 409);
    const bill = await Bill.findOne({ hospitalId, sourceType: "PharmacySale", sourceId: sale.saleId });
    if (bill) return errorResponse("Pharmacy sale cannot be cancelled after a bill has been created", 409);

    const batchIds = [...new Set(sale.items.map((item) => item.batchId))];
    const batches = await MedicineBatch.find({ hospitalId, batchId: { $in: batchIds } });
    const batchById = new Map(batches.map((batch) => [batch.batchId, batch]));
    if (batchIds.some((batchId) => !batchById.has(batchId))) {
      return errorResponse("Cannot cancel sale because a medicine batch is missing", 409);
    }

    for (const item of sale.items) {
      const batch = batchById.get(item.batchId)!;
      const previousQuantity = batch.quantityAvailable;
      batch.quantityAvailable = previousQuantity + item.quantity;
      await batch.save();
      await createStockMovement({
        hospitalId,
        medicineId: item.medicineId,
        batchId: item.batchId,
        type: "Cancel Sale",
        quantity: item.quantity,
        previousQuantity,
        newQuantity: batch.quantityAvailable,
        reason: body.cancellationReason ?? "Sale cancelled",
        referenceType: "Sale",
        referenceId: sale.saleId,
        createdBy: session.payload.userId,
      });
      await updateBatchStatusIfNeeded(item.batchId, hospitalId);
    }
    sale.saleStatus = "Cancelled";
    sale.cancelledAt = new Date();
    sale.cancellationReason = body.cancellationReason ?? "";
    await sale.save();
    return successResponse(serializeDoc(sale), "Pharmacy sale cancelled");
  } catch (error) {
    return handleApiError(error);
  }
}
