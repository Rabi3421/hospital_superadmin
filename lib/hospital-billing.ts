import Bill, { type BillDocument, type BillItem } from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Expense from "@/models/Expense";
import InsuranceClaim from "@/models/InsuranceClaim";
import LabOrder from "@/models/LabOrder";
import PatientDeposit from "@/models/PatientDeposit";
import PaymentReminder from "@/models/PaymentReminder";
import PharmacySale from "@/models/PharmacySale";
import Refund from "@/models/Refund";

export type BillDiscountType = "None" | "Flat" | "Percentage";
export type BillInputItem = Omit<BillItem, "total"> & { total?: number };
export type BillSourceType = BillDocument["sourceType"];

function money(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export async function generateBillId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `BILL-${year}-`;
  const latest = await Bill.findOne({ hospitalId, billId: { $regex: `^${prefix}` } })
    .sort({ billId: -1 })
    .select("billId");
  const nextNumber = latest?.billId ? Number(latest.billId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateBillPaymentId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `PAY-${year}-`;
  const latest = await BillPayment.findOne({ hospitalId, paymentId: { $regex: `^${prefix}` } })
    .sort({ paymentId: -1 })
    .select("paymentId");
  const nextNumber = latest?.paymentId ? Number(latest.paymentId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateRefundId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `RFD-${year}-`;
  const latest = await Refund.findOne({ hospitalId, refundId: { $regex: `^${prefix}` } })
    .sort({ refundId: -1 })
    .select("refundId");
  const nextNumber = latest?.refundId ? Number(latest.refundId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateExpenseId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `EXP-${year}-`;
  const latest = await Expense.findOne({ hospitalId, expenseId: { $regex: `^${prefix}` } })
    .sort({ expenseId: -1 })
    .select("expenseId");
  const nextNumber = latest?.expenseId ? Number(latest.expenseId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateDepositId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `DEP-${year}-`;
  const latest = await PatientDeposit.findOne({ hospitalId, depositId: { $regex: `^${prefix}` } })
    .sort({ depositId: -1 })
    .select("depositId");
  const nextNumber = latest?.depositId ? Number(latest.depositId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateReminderId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `RMD-${year}-`;
  const latest = await PaymentReminder.findOne({ hospitalId, reminderId: { $regex: `^${prefix}` } })
    .sort({ reminderId: -1 })
    .select("reminderId");
  const nextNumber = latest?.reminderId ? Number(latest.reminderId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateClaimId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `CLM-${year}-`;
  const latest = await InsuranceClaim.findOne({ hospitalId, claimId: { $regex: `^${prefix}` } })
    .sort({ claimId: -1 })
    .select("claimId");
  const nextNumber = latest?.claimId ? Number(latest.claimId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function processRefundOnBill(refundId: string, hospitalId: string) {
  const refund = await Refund.findOne({ hospitalId, refundId });
  if (!refund) throw new Error("Refund not found");
  if (refund.status !== "Approved") throw new Error("Refund must be approved before processing");

  const payment = await BillPayment.findOne({ hospitalId, paymentId: refund.paymentId });
  if (!payment) throw new Error("Original payment not found");

  payment.status = "Refunded";
  await payment.save();

  refund.status = "Processed";
  refund.processedAt = new Date();
  await refund.save();

  const bill = await refreshBillPaymentStatus(refund.billId, hospitalId);
  return { refund, bill };
}

export async function checkExistingBillForSource(hospitalId: string, sourceType: BillSourceType, sourceId: string) {
  return Bill.findOne({ hospitalId, sourceType, sourceId });
}

export function validateBillItems(items: BillInputItem[]) {
  if (!items.length) throw new Error("At least one bill item is required");

  items.forEach((item) => {
    if (!item.name?.trim()) throw new Error("Bill item name is required");
    if (!["Consultation", "Lab", "Pharmacy", "Procedure", "Other"].includes(item.itemType)) {
      throw new Error("Invalid bill item type");
    }
    if (Number(item.quantity) <= 0) throw new Error("Bill item quantity must be greater than zero");
    if (Number(item.unitPrice) < 0) throw new Error("Bill item unit price cannot be negative");
  });
}

export function calculateBillTotals(
  items: BillInputItem[],
  discountType: BillDiscountType = "None",
  discountValue = 0,
  taxAmount = 0,
) {
  validateBillItems(items);

  const calculatedItems = items.map((item) => ({
    itemType: item.itemType,
    name: item.name.trim(),
    quantity: money(Number(item.quantity)),
    unitPrice: money(Number(item.unitPrice)),
    total: money(Number(item.quantity) * Number(item.unitPrice)),
  }));
  const subtotal = money(calculatedItems.reduce((sum, item) => sum + item.total, 0));
  const safeDiscountValue = Math.max(Number(discountValue) || 0, 0);
  const safeTaxAmount = money(Math.max(Number(taxAmount) || 0, 0));
  const discountAmount =
    discountType === "Flat"
      ? money(Math.min(safeDiscountValue, subtotal))
      : discountType === "Percentage"
        ? money(subtotal * Math.min(safeDiscountValue, 100) / 100)
        : 0;
  const grandTotal = money(Math.max(subtotal - discountAmount + safeTaxAmount, 0));

  return {
    items: calculatedItems,
    subtotal,
    discountType,
    discountValue: discountType === "None" ? 0 : safeDiscountValue,
    discountAmount,
    taxAmount: safeTaxAmount,
    grandTotal,
  };
}

export function getBillStatusFromAmounts(grandTotal: number, paidAmount: number) {
  if (paidAmount <= 0) return "Unpaid";
  if (paidAmount < grandTotal) return "Partially Paid";
  return "Paid";
}

export function buildConsultationBillItems(unitPrice = 0): BillInputItem[] {
  return [
    {
      itemType: "Consultation",
      name: "Consultation Fee",
      quantity: 1,
      unitPrice,
    },
  ];
}

export function buildLabOrderBillItems(labOrder: Awaited<ReturnType<typeof LabOrder.findOne>>): BillInputItem[] {
  if (!labOrder) throw new Error("Lab order not found");
  return labOrder.tests.map((test) => ({
    itemType: "Lab",
    name: test.testName,
    quantity: 1,
    unitPrice: test.price,
  }));
}

export function buildPharmacySaleBillItems(sale: Awaited<ReturnType<typeof PharmacySale.findOne>>): BillInputItem[] {
  if (!sale) throw new Error("Pharmacy sale not found");
  return sale.items.map((item) => ({
    itemType: "Pharmacy",
    name: item.medicineName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
}

export async function createBillFromSource({
  hospitalId,
  patientId,
  appointmentId = "",
  consultationId = "",
  doctorUserId = "",
  sourceType,
  sourceId,
  sourceRefId,
  items,
  discountType = "None",
  discountValue = 0,
  taxAmount = 0,
  notes = "",
  createdBy = "",
  metadata = {},
}: {
  hospitalId: string;
  patientId: string;
  appointmentId?: string;
  consultationId?: string;
  doctorUserId?: string;
  sourceType: Exclude<BillSourceType, "Manual" | "Mixed">;
  sourceId: string;
  sourceRefId: string;
  items: BillInputItem[];
  discountType?: BillDiscountType;
  discountValue?: number;
  taxAmount?: number;
  notes?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}) {
  const existingBill = await checkExistingBillForSource(hospitalId, sourceType, sourceId);
  if (existingBill) {
    return { bill: existingBill, created: false };
  }

  const totals = calculateBillTotals(items, discountType, discountValue, taxAmount);
  let bill;
  try {
    bill = await Bill.create({
      hospitalId,
      billId: await generateBillId(hospitalId),
      patientId,
      appointmentId,
      consultationId,
      doctorUserId,
      ...totals,
      paidAmount: 0,
      dueAmount: totals.grandTotal,
      status: getBillStatusFromAmounts(totals.grandTotal, 0),
      sourceType,
      sourceId,
      sourceRefId,
      metadata,
      notes,
      createdBy,
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      const racedBill = await checkExistingBillForSource(hospitalId, sourceType, sourceId);
      if (racedBill) return { bill: racedBill, created: false };
    }
    throw error;
  }

  return { bill, created: true };
}

export async function refreshBillPaymentStatus(billId: string, hospitalId: string) {
  const bill = await Bill.findOne({ hospitalId, billId });
  if (!bill) throw new Error("Bill not found");
  if (bill.status === "Cancelled") return bill;

  const payments = await BillPayment.find({ hospitalId, billId, status: "Success" }).select("amount");
  const paidAmount = money(payments.reduce((sum, payment) => sum + payment.amount, 0));
  bill.paidAmount = paidAmount;
  bill.dueAmount = money(Math.max(bill.grandTotal - paidAmount, 0));
  if (bill.status !== "Draft") {
    bill.status = getBillStatusFromAmounts(bill.grandTotal, paidAmount);
  }
  await bill.save();
  return bill;
}
