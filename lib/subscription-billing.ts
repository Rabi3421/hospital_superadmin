import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";

export const BILLING_DUE_DAY = 5;
export const BILLING_GRACE_END_DAY = 10;
const IST_OFFSET_MS = 330 * 60 * 1000;

function indiaDateParts(date: Date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
  };
}

function indiaDate(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0, milliseconds = 0) {
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds) - IST_OFFSET_MS);
}

export function billingMonthFor(date: Date) {
  const { year, month } = indiaDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function billingDueDateForMonth(billingMonth: string) {
  const [year, month] = billingMonth.split("-").map(Number);
  return indiaDate(year, month - 1, BILLING_DUE_DAY);
}

export function nextMonthlyDueDate(from = new Date()) {
  const { year, month } = indiaDateParts(from);
  return indiaDate(year, month + 1, BILLING_DUE_DAY);
}

export function graceEndsFor(dueDate: Date) {
  const { year, month } = indiaDateParts(dueDate);
  return indiaDate(year, month, BILLING_GRACE_END_DAY, 23, 59, 59, 999);
}

export function dueDayEndsFor(dueDate: Date) {
  const { year, month } = indiaDateParts(dueDate);
  return indiaDate(year, month, BILLING_DUE_DAY, 23, 59, 59, 999);
}

export async function reconcileSubscriptionBilling(hospitalId: string, now = new Date()) {
  const [subscription, hospital] = await Promise.all([
    Subscription.findOne({ hospitalId }),
    Hospital.findOne({ hospitalId }),
  ]);
  if (!subscription || !["Active", "Overdue", "Suspended"].includes(subscription.status) || !subscription.nextBillingDate) {
    return subscription;
  }
  if (subscription.status === "Suspended" && !subscription.suspendedForNonPaymentAt) {
    return subscription;
  }

  let dueDate = new Date(subscription.nextBillingDate);
  let lastPaidBillingMonth = "";

  while (dueDate <= now) {
    const billingMonth = billingMonthFor(dueDate);
    const paid = await PlatformPayment.exists({
      hospitalId,
      billingMonth,
      status: "Paid",
      amount: { $gte: subscription.monthlyPrice },
    });
    if (!paid) break;
    lastPaidBillingMonth = billingMonth;
    dueDate = nextMonthlyDueDate(dueDate);
  }

  subscription.nextBillingDate = dueDate;
  subscription.graceEndsAt = graceEndsFor(dueDate);
  if (lastPaidBillingMonth) {
    subscription.lastPaidBillingMonth = lastPaidBillingMonth;
  }

  if (dueDate > now) {
    subscription.status = "Active";
    subscription.suspendedForNonPaymentAt = undefined;
    await subscription.save();

    if (hospital?.suspendedForNonPaymentAt) {
      await Hospital.updateOne(
        { hospitalId },
        { $set: { status: "Active", nextBillingDate: dueDate }, $unset: { suspendedForNonPaymentAt: 1 } },
      );
    } else {
      await Hospital.updateOne({ hospitalId }, { $set: { nextBillingDate: dueDate } });
    }
    return subscription;
  }

  const graceEndsAt = graceEndsFor(dueDate);
  if (now > graceEndsAt) {
    subscription.status = "Suspended";
    subscription.suspendedForNonPaymentAt ??= now;
    await Promise.all([
      subscription.save(),
      Hospital.updateOne(
        { hospitalId },
        { $set: { status: "Suspended", suspendedForNonPaymentAt: subscription.suspendedForNonPaymentAt } },
      ),
    ]);
  } else if (now > dueDayEndsFor(dueDate)) {
    subscription.status = "Overdue";
    await subscription.save();
  } else {
    subscription.status = "Active";
    await subscription.save();
  }

  return subscription;
}
