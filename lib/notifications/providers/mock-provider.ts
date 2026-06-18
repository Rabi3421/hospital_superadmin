import type { NotificationProvider, SendNotificationInput, SendNotificationResult } from "../types";

export class MockProvider implements NotificationProvider {
  name = "MOCK";

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    console.log(`[MOCK ${input.channel}] To: ${input.to} | Message: ${input.message.slice(0, 80)}...`);
    return { success: true, providerMessageId: `mock-${Date.now()}` };
  }
}
