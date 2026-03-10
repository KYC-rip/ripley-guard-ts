import {
  XMR402Relay,
  XMR402WSOptions,
  XMR402Frame
} from './relay';

/**
 * Nostr XMR402 Payment Gate Adapter (v2.0)
 * 
 * Maps Nostr relay protocol messages to XMR402 challenges.
 * Designed for anti-spam or paid-relay access (NIP-style).
 */
export class NostrXMR402Gate {
  private relay: XMR402Relay;

  constructor(options: XMR402WSOptions) {
    this.relay = new XMR402Relay(options);
  }

  /**
   * Generates a Nostr-compatible NOTICE frame containing an XMR402 challenge.
   * Format: ["NOTICE", "PAYMENT_REQUIRED: XMR402 address=... amount=... message=... timestamp=..."]
   */
  async createNostrChallenge(pubkey: string, intent: string, amount: number): Promise<[string, string]> {
    const frame = await this.relay.createChallenge(pubkey, intent, amount);

    if (frame.type !== 'PAYMENT_CHALLENGE') {
      throw new Error("Unexpected frame type from relay");
    }

    // Convert JSON frame to the standardized Nostr NOTICE string format
    const challengeStr = `XMR402 address="${frame.address}", amount="${frame.amount}", message="${frame.message}", timestamp="${frame.timestamp}"`;
    return ["NOTICE", `PAYMENT_REQUIRED: ${challengeStr}`];
  }

  /**
   * Helper to parse a PAYMENT_PROOF from a custom XMR402 Nostr Event (Kind 402)
   * or a custom message frame.
   */
  async verifyNostrProof(proofFrame: XMR402Frame, minAmount: number) {
    return await this.relay.verifyProof(proofFrame, minAmount);
  }
}
