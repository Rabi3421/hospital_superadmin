import type { NotificationProvider } from "./types";
import { MockProvider } from "./providers/mock-provider";
import { Msg91Provider } from "./providers/msg91-provider";
import { TwilioProvider } from "./providers/twilio-provider";
import { GupshupProvider } from "./providers/gupshup-provider";

const providers: Record<string, () => NotificationProvider> = {
  MOCK: () => new MockProvider(),
  MSG91: () => new Msg91Provider(),
  TWILIO: () => new TwilioProvider(),
  GUPSHUP: () => new GupshupProvider(),
};

export function getProvider(name: string): NotificationProvider {
  const factory = providers[name] || providers.MOCK;
  return factory();
}
