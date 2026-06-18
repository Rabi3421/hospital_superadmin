export type NotificationChannel = "WHATSAPP" | "SMS";

export interface SendNotificationInput {
  hospitalId: string;
  channel: NotificationChannel;
  to: string;
  message: string;
  templateId?: string;
  templateName?: string;
  variables?: Record<string, string | number>;
  metadata?: Record<string, unknown>;
}

export interface SendNotificationResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  raw?: unknown;
}

export interface NotificationProvider {
  name: string;
  send(input: SendNotificationInput): Promise<SendNotificationResult>;
}

export interface EventNotificationInput {
  hospitalId: string;
  eventType: string;
  channels?: NotificationChannel[];
  recipient: {
    type: string;
    name: string;
    phone: string;
    userId?: string;
    patientId?: string;
  };
  context: Record<string, unknown>;
  relatedIds?: {
    appointmentId?: string;
    prescriptionId?: string;
    labReportId?: string;
    billId?: string;
    paymentId?: string;
    pharmacySaleId?: string;
  };
}
