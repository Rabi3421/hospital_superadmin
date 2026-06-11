import Medicine from "@/models/Medicine";
import MedicineBatch from "@/models/MedicineBatch";
import PharmacySale, { type PharmacySaleItem } from "@/models/PharmacySale";
import StockMovement from "@/models/StockMovement";

export type SaleDiscountType = "None" | "Flat" | "Percentage";
export type SaleInputItem = { medicineId: string; batchId?: string; quantity: number };

function money(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export async function generateMedicineId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `MED-${year}-`;
  const latest = await Medicine.findOne({ hospitalId, medicineId: { $regex: `^${prefix}` } }).sort({ medicineId: -1 }).select("medicineId");
  const nextNumber = latest?.medicineId ? Number(latest.medicineId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateMedicineBatchId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `BATCH-${year}-`;
  const latest = await MedicineBatch.findOne({ hospitalId, batchId: { $regex: `^${prefix}` } }).sort({ batchId: -1 }).select("batchId");
  const nextNumber = latest?.batchId ? Number(latest.batchId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateStockMovementId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `MOV-${year}-`;
  const latest = await StockMovement.findOne({ hospitalId, movementId: { $regex: `^${prefix}` } }).sort({ movementId: -1 }).select("movementId");
  const nextNumber = latest?.movementId ? Number(latest.movementId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generatePharmacySaleId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `SALE-${year}-`;
  const latest = await PharmacySale.findOne({ hospitalId, saleId: { $regex: `^${prefix}` } }).sort({ saleId: -1 }).select("saleId");
  const nextNumber = latest?.saleId ? Number(latest.saleId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export function calculateSaleTotals(
  items: PharmacySaleItem[],
  discountType: SaleDiscountType = "None",
  discountValue = 0,
  taxAmount = 0,
) {
  const subtotal = money(items.reduce((sum, item) => sum + item.total, 0));
  const safeDiscountValue = Math.max(Number(discountValue) || 0, 0);
  const discountAmount =
    discountType === "Flat"
      ? money(Math.min(safeDiscountValue, subtotal))
      : discountType === "Percentage"
        ? money(subtotal * Math.min(safeDiscountValue, 100) / 100)
        : 0;
  const safeTaxAmount = money(Math.max(Number(taxAmount) || 0, 0));
  const grandTotal = money(Math.max(subtotal - discountAmount + safeTaxAmount, 0));
  return {
    subtotal,
    discountType,
    discountValue: discountType === "None" ? 0 : safeDiscountValue,
    discountAmount,
    taxAmount: safeTaxAmount,
    grandTotal,
  };
}

export async function getAvailableStock(hospitalId: string, medicineId: string) {
  const batches = await MedicineBatch.find({
    hospitalId,
    medicineId,
    status: "Active",
    expiryDate: { $gte: new Date() },
  }).select("quantityAvailable");
  return batches.reduce((sum, batch) => sum + batch.quantityAvailable, 0);
}

export async function updateBatchStatusIfNeeded(batchId: string, hospitalId: string) {
  const batch = await MedicineBatch.findOne({ hospitalId, batchId });
  if (!batch || batch.status === "Cancelled") return batch;
  const now = new Date();
  if (batch.expiryDate < now) batch.status = "Expired";
  else if (batch.quantityAvailable <= 0) batch.status = "Finished";
  else batch.status = "Active";
  await batch.save();
  return batch;
}

export async function createStockMovement({
  hospitalId,
  medicineId,
  batchId,
  type,
  quantity,
  previousQuantity,
  newQuantity,
  reason = "",
  referenceType,
  referenceId = "",
  createdBy = "",
}: {
  hospitalId: string;
  medicineId: string;
  batchId: string;
  type: "Stock In" | "Sale" | "Adjustment" | "Return" | "Cancel Sale";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  referenceType: "Batch" | "Sale" | "Manual" | "Prescription";
  referenceId?: string;
  createdBy?: string;
}) {
  return StockMovement.create({
    hospitalId,
    movementId: await generateStockMovementId(hospitalId),
    medicineId,
    batchId,
    type,
    quantity,
    previousQuantity,
    newQuantity,
    reason,
    referenceType,
    referenceId,
    createdBy,
  });
}

export async function allocateStockFIFO(hospitalId: string, medicineId: string, quantity: number, batchId?: string) {
  const filter = batchId
    ? { hospitalId, medicineId, batchId, status: "Active" as const }
    : { hospitalId, medicineId, status: "Active" as const };
  const batches = await MedicineBatch.find(filter).sort({ expiryDate: 1, receivedDate: 1 });
  let remaining = quantity;
  const allocations: { batchId: string; batchNumber: string; quantity: number; unitPrice: number; previousQuantity: number; newQuantity: number }[] = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    if (batch.expiryDate < new Date() || batch.quantityAvailable <= 0) {
      await updateBatchStatusIfNeeded(batch.batchId, hospitalId);
      continue;
    }
    const taken = Math.min(batch.quantityAvailable, remaining);
    allocations.push({
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      quantity: taken,
      unitPrice: batch.sellingPrice,
      previousQuantity: batch.quantityAvailable,
      newQuantity: batch.quantityAvailable - taken,
    });
    remaining -= taken;
  }

  if (remaining > 0) throw new Error("Insufficient medicine stock");
  return allocations;
}

export async function validateSaleItems(hospitalId: string, items: SaleInputItem[]) {
  if (!items.length) throw new Error("At least one sale item is required");
  for (const item of items) {
    if (!item.medicineId) throw new Error("Medicine ID is required");
    if (Number(item.quantity) <= 0) throw new Error("Sale item quantity must be greater than zero");
    const medicine = await Medicine.findOne({ hospitalId, medicineId: item.medicineId, status: "Active" });
    if (!medicine) throw new Error("Medicine not found or inactive");
    const available = await getAvailableStock(hospitalId, item.medicineId);
    if (available < item.quantity) throw new Error("Insufficient medicine stock");
  }
}
