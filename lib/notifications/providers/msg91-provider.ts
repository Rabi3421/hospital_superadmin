import type { NotificationProvider, SendNotificationInput, SendNotificationResult } from "../types";

export class Msg91Provider implements NotificationProvider {
  name = "MSG91";

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      return {
        success: false,
        error: "MSG91_AUTH_KEY environment variable is not configured. Please set it to enable MSG91 notifications.",
      };
    }

    // TODO: Implement actual MSG91 API integration
    // Documentation: https://docs.msg91.com/
    // For WhatsApp: POST https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/
    // For SMS: POST https://api.msg91.com/api/v5/flow/
    return {
      success: false,
      error: "MSG91 provider is not yet implemented. Please use MOCK provider for testing.",
    };
  }
}
