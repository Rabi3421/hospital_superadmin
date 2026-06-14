import { billingMonthFor, dueDayEndsFor, graceEndsFor } from "@/lib/subscription-billing";
import BillingReminder from "@/models/BillingReminder";
import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";
import Subscription from "@/models/Subscription";

export type CollectionStage = "Trial" | "Upcoming" | "Due" | "Grace" | "Suspended" | "Paid" | "Cancelled";

export function collectionStage(
  subscription: { status: string; nextBillingDate?: Date | string; suspendedForNonPaymentAt?: Date | string },
  paidForBillingMonth: boolean,
  now = new Date(),
): CollectionStage {
  if (subscription.status === "Trial") return "Trial";
  if (subscription.status === "Cancelled") return "Cancelled";
  if (paidForBillingMonth) return "Paid";
  if (subscription.status === "Suspended" && subscription.suspendedForNonPaymentAt) return "Suspended";
  if (!subscription.nextBillingDate) return "Upcoming";

  const dueDate = new Date(subscription.nextBillingDate);
  if (now < dueDate) return "Upcoming";
  if (now <= dueDayEndsFor(dueDate)) return "Due";
  if (now <= graceEndsFor(dueDate)) return "Grace";
  return "Suspended";
}

export function collectionBillingMonth(subscription: { nextBillingDate?: Date | string }) {
  return subscription.nextBillingDate ? billingMonthFor(new Date(subscription.nextBillingDate)) : "";
}

export function defaultReminderMessage(input: {
  hospitalName: string;
  stage: CollectionStage;
  amount: number;
  dueDate?: Date | string;
  graceEndsAt?: Date | string;
}) {
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(input.amount);
  const due = input.dueDate ? new Date(input.dueDate).toLocaleDateString("en-IN") : "the scheduled due date";
  const grace = input.graceEndsAt ? new Date(input.graceEndsAt).toLocaleDateString("en-IN") : "the grace deadline";

  if (input.stage === "Suspended") {
    return `${input.hospitalName}: service is suspended because the ${amount} subscription payment due on ${due} remains unpaid. Please submit payment details for verification to restore access.`;
  }
  if (input.stage === "Grace") {
    return `${input.hospitalName}: the ${amount} subscription payment due on ${due} is overdue. The grace period ends on ${grace}, after which service will be suspended until payment is verified.`;
  }
  if (input.stage === "Due") {
    return `${input.hospitalName}: your ${amount} monthly subscription payment is due on ${due}. Please submit payment details from the owner billing dashboard.`;
  }
  return `${input.hospitalName}: your next ${amount} subscription payment is scheduled for ${due}.`;
}

export async function ensureAutomaticBillingReminder(hospitalId: string) {
  const [hospital, subscription] = await Promise.all([
    Hospital.findOne({ hospitalId }),
    Subscription.findOne({ hospitalId }),
  ]);
  if (!hospital || !subscription || !subscription.nextBillingDate || ["Trial", "Cancelled"].includes(subscription.status)) {
    return null;
  }

  const billingMonth = collectionBillingMonth(subscription);
  const paid = await PlatformPayment.exists({
    hospitalId,
    billingMonth,
    status: "Paid",
    amount: { $gte: subscription.monthlyPrice },
  });
  const stage = collectionStage(subscription, Boolean(paid));
  if (!["Due", "Grace", "Suspended"].includes(stage)) return null;
  const reminderStage = stage as "Due" | "Grace" | "Suspended";

  const existing = await BillingReminder.exists({
    hospitalId,
    billingMonth,
    channel: "In App",
    stage: reminderStage,
  });
  if (existing) return null;

  return BillingReminder.create({
    hospitalId,
    billingMonth,
    channel: "In App",
    recipient: hospital.ownerName,
    stage: reminderStage,
    message: defaultReminderMessage({
      hospitalName: hospital.name,
      stage: reminderStage,
      amount: subscription.monthlyPrice,
      dueDate: subscription.nextBillingDate,
      graceEndsAt: subscription.graceEndsAt,
    }),
    status: "Sent",
    sentBy: "system-dunning",
    sentAt: new Date(),
  });
}
