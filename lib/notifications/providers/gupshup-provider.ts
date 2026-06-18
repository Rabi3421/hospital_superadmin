import type { NotificationProvider, SendNotificationInput, SendNotificationResult } from "../types";

export class GupshupProvider implements NotificationProvider {
  name = "GUPSHUP";

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const apiKey = process.env.GUPSHUP_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "GUPSHUP_API_KEY environment variable is not configured. Please set it to enable Gupshup notifications.",
      };
    }

    // TODO: Implement actual Gupshup API integration
    // Documentation: https://docs.gupshup.io/
    // For WhatsApp: POST https://api.gupshup.io/wa/api/v1/msg
    // For SMS: POST https://enterprise.smsgupshup.com/GatewayAPI/rest
    return {
      success: false,
      error: "Gupshup provider is not yet implemented. Please use MOCK provider for testing.",
    };
  }
}
