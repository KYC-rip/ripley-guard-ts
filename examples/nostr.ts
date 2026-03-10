import { NostrXMR402Gate } from '../src/ws/nostr';

/**
 * XMR402 Nostr Relay Example (v2.0)
 * 
 * Demonstrates how to gate a Nostr relay using NIP-style NOTICE challenges.
 */

const options = {
  walletAddress: "888tNkbaB65ad3hgE9R916PP56bdz1c9v...",
  serverSecret: "nostr_gate_secret",
  nodeRpcUrl: "https://rpc.kyc.rip"
};

const gate = new NostrXMR402Gate(options);

async function handleNostrEvent(pubkey: string, eventKind: number) {
  console.log(`INCOMING_EVENT: Kind ${eventKind} from ${pubkey}`);

  // All events of Kind 1 (Text Note) require a small anti-spam fee
  if (eventKind === 1) {
    const amount = 500; // 500 piconero
    const intent = `PUBLISH_KIND_1_${Date.now()}`;

    // Generate the standardized Nostr NOTICE challenge
    const [tag, challengeMsg] = await gate.createNostrChallenge(pubkey, intent, amount);
    
    console.log("SENDING_NOSTR_NOTICE:", [tag, challengeMsg]);
    // Relay would send: ["NOTICE", "PAYMENT_REQUIRED: XMR402 address=..."]
  }
}

// Simulate client providing proof via a custom frame or Kind 402 event
async function verifyClientProof(proofFrame: any) {
  const minAmount = 500;
  const result = await gate.verifyNostrProof(proofFrame, minAmount);

  if (result.success) {
    console.log("PROOF_VALIDATED: Broadcasting Nostr event to network.");
  } else {
    console.log("PROOF_INVALID:", result.error);
  }
}

handleNostrEvent("npub1...", 1);
