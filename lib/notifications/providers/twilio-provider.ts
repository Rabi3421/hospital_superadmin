import type { NotificationProvider, SendNotificationInput, SendNotificationResult } from "../types";

export class TwilioProvider implements NotificationProvider {
  name = "TWILIO";

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return {
        success: false,
        error:
          "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are not configured. Please set both to enable Twilio notifications.",
      };
    }

    // TODO: Implement actual Twilio API integration
    // Documentation: https://www.twilio.com/docs/messaging/api
    // For WhatsApp: Use Twilio WhatsApp Business API
    // For SMS: Use Twilio Programmable Messaging
    return {
      success: false,
      error: "Twilio provider is not yet implemented. Please use MOCK provider for testing.",
    };
  }
}
