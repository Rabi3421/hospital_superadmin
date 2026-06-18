import { connectDb } from "@/lib/db";
import HospitalNotificationSetting from "@/models/HospitalNotificationSetting";
import NotificationTemplate from "@/models/NotificationTemplate";
import NotificationLog from "@/models/NotificationLog";
import NotificationPreference from "@/models/NotificationPreference";
import { getProvider } from "./provider-factory";
import { renderTemplate } from "./template-renderer";
import { defaultTemplates } from "./default-templates";
import type { EventNotificationInput, NotificationChannel } from "./types";

// Generate notification ID: NTF-YYYY-XXXX
async function generateNotificationId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `NTF-${year}-`;
  const latest = await NotificationLog.findOne({ hospitalId, notificationId: { $regex: `^${prefix}` } })
    .sort({ notificationId: -1 })
    .select("notificationId");
  const nextNumber = latest?.notificationId ? Number(latest.notificationId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

// Generate template ID: NTF-TPL-YYYY-XXXX
export async function generateTemplateId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `NTF-TPL-${year}-`;
  const latest = await NotificationTemplate.findOne({ hospitalId, templateId: { $regex: `^${prefix}` } })
    .sort({ templateId: -1 })
    .select("templateId");
  const nextNumber = latest?.templateId ? Number(latest.templateId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

// Get or create default settings for a hospital
export async function getOrCreateNotificationSettings(hospitalId: string) {
  let settings = await HospitalNotificationSetting.findOne({ hospitalId });
  if (!settings) {
    settings = await HospitalNotificationSetting.create({
      hospitalId,
      whatsappEnabled: false,
      smsEnabled: false,
      defaultChannel: "NONE",
      provider: "MOCK",
      smsProvider: "MOCK",
      whatsappProvider: "MOCK",
    });
  }
  return settings;
}

// Get template for event+channel, fallback to default
export async function getTemplate(hospitalId: string, eventType: string, channel: NotificationChannel) {
  // First try to find a hospital-specific active template
  const template = await NotificationTemplate.findOne({
    hospitalId,
    eventType: eventType as any,
    channel,
    isActive: true,
  });

  if (template) return template;

  // Fallback to default template from the defaults array
  const defaultTemplate = defaultTemplates.find((t) => t.eventType === eventType && t.channel === channel);

  if (defaultTemplate) {
    return {
      body: defaultTemplate.body,
      variables: defaultTemplate.variables,
      templateId: "",
      providerTemplateId: "",
      providerTemplateName: "",
    };
  }

  return null;
}

// Event type to settings flag mapping
const eventCategoryMap: Record<string, string> = {
  APPOINTMENT_BOOKED: "appointmentNotificationsEnabled",
  APPOINTMENT_REQUESTED: "appointmentNotificationsEnabled",
  APPOINTMENT_CONFIRMED: "appointmentNotificationsEnabled",
  APPOINTMENT_CANCELLED: "appointmentNotificationsEnabled",
  APPOINTMENT_CHECKED_IN: "appointmentNotificationsEnabled",
  PATIENT_READY_FOR_DOCTOR: "appointmentNotificationsEnabled",
  DOCTOR_STARTED_CONSULTATION: "appointmentNotificationsEnabled",
  SLOT_REMINDER: "appointmentNotificationsEnabled",
  QUEUE_TURN_NEAR: "queueNotificationsEnabled",
  PRESCRIPTION_ISSUED: "prescriptionNotificationsEnabled",
  LAB_REPORT_READY: "labNotificationsEnabled",
  PAYMENT_RECEIVED: "billingNotificationsEnabled",
  BILL_GENERATED: "billingNotificationsEnabled",
  PHARMACY_SALE_COMPLETED: "pharmacyNotificationsEnabled",
  FOLLOW_UP_REMINDER: "followUpNotificationsEnabled",
};

// Check if event category is enabled in settings
function isEventEnabled(settings: Record<string, unknown>, eventType: string): boolean {
  const settingKey = eventCategoryMap[eventType];
  if (!settingKey) return true; // Unknown events are allowed by default
  return settings[settingKey] !== false;
}

// Event type to preference flag mapping
const eventPreferenceMap: Record<string, string> = {
  APPOINTMENT_BOOKED: "appointmentUpdates",
  APPOINTMENT_REQUESTED: "appointmentUpdates",
  APPOINTMENT_CONFIRMED: "appointmentUpdates",
  APPOINTMENT_CANCELLED: "appointmentUpdates",
  APPOINTMENT_CHECKED_IN: "appointmentUpdates",
  PATIENT_READY_FOR_DOCTOR: "appointmentUpdates",
  DOCTOR_STARTED_CONSULTATION: "appointmentUpdates",
  SLOT_REMINDER: "appointmentUpdates",
  QUEUE_TURN_NEAR: "appointmentUpdates",
  PRESCRIPTION_ISSUED: "prescriptionUpdates",
  LAB_REPORT_READY: "labUpdates",
  PAYMENT_RECEIVED: "billingUpdates",
  BILL_GENERATED: "billingUpdates",
  PHARMACY_SALE_COMPLETED: "billingUpdates",
  FOLLOW_UP_REMINDER: "appointmentUpdates",
};

// Check patient notification preference
async function checkRecipientPreference(
  hospitalId: string,
  patientId: string | undefined,
  eventType: string,
): Promise<boolean> {
  if (!patientId) return true;

  const preference = await NotificationPreference.findOne({ hospitalId, patientId });
  if (!preference) return true; // No preference means opt-in by default

  // Check channel-level opt-in
  if (!preference.whatsappOptIn && !preference.smsOptIn) return false;

  // Check event-category-level preference
  const prefKey = eventPreferenceMap[eventType];
  if (prefKey && (preference as unknown as Record<string, unknown>)[prefKey] === false) return false;

  return true;
}

// Main function: send event notification (best-effort, never throws)
export async function sendEventNotification(input: EventNotificationInput): Promise<void> {
  try {
    await connectDb();
    const settings = await getOrCreateNotificationSettings(input.hospitalId);

    // Determine channels
    const channels: NotificationChannel[] = input.channels ? [...input.channels] : [];
    if (!channels.length) {
      if (settings.whatsappEnabled) channels.push("WHATSAPP");
      if (settings.smsEnabled) channels.push("SMS");
    }
    if (!channels.length) return; // No channels enabled

    // Check if event type is enabled
    if (!isEventEnabled(settings as unknown as Record<string, unknown>, input.eventType)) return;

    // Check recipient preference
    if (input.recipient.patientId) {
      const allowed = await checkRecipientPreference(input.hospitalId, input.recipient.patientId, input.eventType);
      if (!allowed) return;
    }

    // Send on each channel
    for (const channel of channels) {
      const template = await getTemplate(input.hospitalId, input.eventType, channel);
      const message = template
        ? renderTemplate(template.body, input.context as Record<string, string | number>)
        : `Notification: ${input.eventType}`;

      const providerName = channel === "WHATSAPP" ? settings.whatsappProvider : settings.smsProvider;
      const provider = getProvider(providerName);

      const notificationId = await generateNotificationId(input.hospitalId);

      try {
        const result = await provider.send({
          hospitalId: input.hospitalId,
          channel,
          to: input.recipient.phone,
          message,
          templateId: template?.providerTemplateId,
          templateName: template?.providerTemplateName,
        });

        await NotificationLog.create({
          hospitalId: input.hospitalId,
          notificationId,
          eventType: input.eventType,
          channel,
          recipientType: input.recipient.type,
          recipientName: input.recipient.name,
          recipientPhone: input.recipient.phone,
          recipientUserId: input.recipient.userId || "",
          patientId: input.recipient.patientId || "",
          ...input.relatedIds,
          templateId: template?.templateId || "",
          messagePreview: message.slice(0, 200),
          provider: providerName,
          providerMessageId: result.providerMessageId || "",
          status: result.success ? "SENT" : "FAILED",
          failureReason: result.error || "",
          sentAt: result.success ? new Date() : undefined,
        } as Record<string, unknown>);
      } catch (sendError) {
        await NotificationLog.create({
          hospitalId: input.hospitalId,
          notificationId,
          eventType: input.eventType,
          channel,
          recipientType: input.recipient.type,
          recipientName: input.recipient.name,
          recipientPhone: input.recipient.phone,
          messagePreview: message.slice(0, 200),
          provider: providerName,
          status: "FAILED",
          failureReason: sendError instanceof Error ? sendError.message : "Unknown error",
        } as Record<string, unknown>);
      }
    }
  } catch (error) {
    // Never throw - notification failure must not break business flow
    console.error("[NotificationService] Error:", error instanceof Error ? error.message : error);
  }
}

// Test send - this CAN throw for the test-send API
export async function testSendNotification(
  hospitalId: string,
  channel: NotificationChannel,
  phone: string,
  message: string,
) {
  await connectDb();
  const settings = await getOrCreateNotificationSettings(hospitalId);

  const providerName = channel === "WHATSAPP" ? settings.whatsappProvider : settings.smsProvider;
  const provider = getProvider(providerName);

  const result = await provider.send({
    hospitalId,
    channel,
    to: phone,
    message,
  });

  const notificationId = await generateNotificationId(hospitalId);

  await NotificationLog.create({
    hospitalId,
    notificationId,
    eventType: "TEST_SEND",
    channel,
    recipientType: "ADMIN",
    recipientName: "Test",
    recipientPhone: phone,
    messagePreview: message.slice(0, 200),
    provider: providerName,
    providerMessageId: result.providerMessageId || "",
    status: result.success ? "SENT" : "FAILED",
    failureReason: result.error || "",
    sentAt: result.success ? new Date() : undefined,
  } as Record<string, unknown>);

  if (!result.success) {
    throw new Error(result.error || "Failed to send test notification");
  }

  return result;
}
