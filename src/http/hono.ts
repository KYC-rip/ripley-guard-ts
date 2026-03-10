import { Context, Next } from 'hono';
import {
  generateNonce,
  verifyPayment,
  hashPayload,
  AUTH_REGEX,
  NonceContext
} from '../core';

export interface RipleyGuardOptions {
  nodeRpcUrl: string;
  walletAddress: string;
  amountPiconero: number;
  serverSecret: string;
  expireWindowMs?: number;
}

export function ripleyGuardHono(options: RipleyGuardOptions) {
  const {
    nodeRpcUrl,
    walletAddress,
    amountPiconero,
    serverSecret,
    expireWindowMs = 300000
  } = options;

  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const timestamp = Date.now();
    const timeWindow = Math.floor(timestamp / expireWindowMs);
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown-ip';

    // 1. Instruction Binding: Hash the request body
    const bodyText = (c.req.method === 'GET' || c.req.method === 'HEAD') ? '' : await c.req.raw.clone().text();
    const payloadHash = await hashPayload(bodyText);

    const nonceCtx: NonceContext = {
      clientIp,
      url: c.req.url,
      payloadHash,
      timestamp: timeWindow.toString()
    };

    // Calculate current and previous nonces for rolling window
    const expectedNonce = await generateNonce(serverSecret, nonceCtx);
    const prevNonce = await generateNonce(serverSecret, { ...nonceCtx, timestamp: (timeWindow - 1).toString() });

    // 2. Challenge: No credentials, return 402
    if (!authHeader || !authHeader.startsWith('XMR402')) {
      const challenge = `XMR402 address="${walletAddress}", amount="${amountPiconero}", message="${expectedNonce}", timestamp="${timestamp}"`;
      c.header('WWW-Authenticate', challenge);
      return c.json({ error: 'TACTICAL_PAYMENT_REQUIRED', protocol: 'XMR402' }, 402);
    }

    // 3. Attempt to break through: Extract TxID and Proof
    const matches = authHeader.match(AUTH_REGEX);
    if (!matches || matches.length !== 3) {
      return c.json({ error: 'INVALID_XMR402_FORMAT' }, 400);
    }

    const txid = matches[1];
    const proof = matches[2];

    // 4. Verification with rolling window grace
    const verify = (nonce: string) => verifyPayment(nodeRpcUrl, {
      txid,
      address: walletAddress,
      message: nonce,
      signature: proof,
      minAmount: amountPiconero
    });

    const currentResult = await verify(expectedNonce);
    let isValid = currentResult.success;

    if (!isValid) {
      const prevResult = await verify(prevNonce);
      isValid = prevResult.success;
    }

    if (!isValid) {
      console.log(`[GUARD_FAIL] IP: ${clientIp} URL: ${c.req.url} TXID: ${txid}`);
      return c.json({ error: 'INVALID_PROOF_OR_FUNDS_MISSING' }, 403);
    }

    await next();
  };
}

export interface PaymentRule {
  accepts: string[];
  amount: number;
}

export type PaymentConfig = Record<string, PaymentRule>;

export function paymentMiddleware(config: PaymentConfig) {
  const nodeRpcUrl = process.env.XMR_RPC_URL || 'http://127.0.0.1:18081/json_rpc';
  const walletAddress = process.env.XMR_WALLET_ADDRESS || '';
  const serverSecret = process.env.XMR_SERVER_SECRET || 'default_dev_secret';

  return async (c: Context, next: Next) => {
    const routeKey = `${c.req.method} ${c.req.path}`;
    const rule = config[routeKey];

    if (!rule || !rule.accepts?.includes('XMR')) {
      return await next();
    }

    const amountPiconero = Math.floor(rule.amount * 1e12);

    const guard = ripleyGuardHono({
      nodeRpcUrl,
      walletAddress,
      amountPiconero,
      serverSecret
    });

    return await guard(c, next);
  };
}