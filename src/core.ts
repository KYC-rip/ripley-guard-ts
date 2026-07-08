// Use globalThis.crypto for cross-environment support (Node 19+, Deno, Bun, Browser)
const crypto = globalThis.crypto;

export interface XMR402CoreOptions {
  walletAddress: string;
  serverSecret: string;
  nodeRpcUrl: string;
}

export interface NonceContext {
  clientIp: string;
  url: string;
  payloadHash: string;
  timestamp: string;
}

export const AUTH_REGEX = /^XMR402\s+txid="([^"]+)",\s*proof="([^"]+)"$/;

/**
 * Generates a stateless, intent-bound nonce (message) for XMR402 v2.0.
 *
 * Binds the client IP + intent (url + request body) + a rolling time window + the server
 * secret. The IP binding pins a captured (txid, proof) to one source IP for anti-replay.
 * NOTE for Tor clients: the challenge and the proof-carrying retry must egress the same
 * exit IP (they do within Tor's ~10 min MaxCircuitDirtiness window when both hit the same
 * host through one embed) or the nonce won't re-derive. If an end-to-end Tor flow returns
 * 403 despite a valid proof, this IP binding is the cause — drop clientIp here then.
 */
export async function generateNonce(secret: string, ctx: NonceContext): Promise<string> {
  const { clientIp, url, payloadHash, timestamp } = ctx;
  const rawData = `${clientIp}:${url}:${payloadHash}:${timestamp}:${secret}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(rawData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Return hex string (first 16 chars as common practice, or full hash)
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Validates a Monero TX Proof against the expected amount and address via RPC.
 * Zero-confirmation / Mempool aware.
 */
export async function verifyPayment(
  rpcUrl: string,
  params: {
    txid: string;
    address: string;
    message: string;
    signature: string;
    minAmount: number;
  },
  // Extra headers for the RPC call — e.g. a Cloudflare Access service token
  // (CF-Access-Client-Id / CF-Access-Client-Secret) or Basic auth when the
  // Monero wallet-RPC sits behind an auth gate. Empty by default.
  extraHeaders: Record<string, string> = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanRpcUrl = rpcUrl.endsWith('/json_rpc') ? rpcUrl : rpcUrl.replace(/\/$/, '') + '/json_rpc';

    const response = await fetch(cleanRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'xmr402-core',
        method: 'check_tx_proof',
        params: {
          txid: params.txid,
          address: params.address,
          message: params.message,
          signature: params.signature
        }
      })
    });

    const data = await response.json() as any;

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const { good, received } = data.result || {};

    if (good === true && received >= params.minAmount) {
      return { success: true };
    }

    return { success: false, error: 'INVALID_PROOF_OR_INSUFFICIENT_FUNDS' };
  } catch (err) {
    return { success: false, error: 'RPC_UPLINK_OFFLINE' };
  }
}

/**
 * Utility to hash request body for intent binding
 */
export async function hashPayload(payload: string | Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const data = typeof payload === 'string' ? encoder.encode(payload) : payload;
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}