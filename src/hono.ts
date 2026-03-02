import { Context, Next } from 'hono';
import { RipleyGuardOptions, AUTH_REGEX, verifyProofOnChain, PaymentConfig } from './core';

export function ripleyGuardHono(options: RipleyGuardOptions) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const timeWindow = Math.floor(Date.now() / (options.expireWindowMs || 300000));
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown-ip';
    const rawData = `${clientIp}:${c.req.url}:${timeWindow}:${options.serverSecret}`;

    const encoder = new TextEncoder();

    // Calculate current nonce
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawData));
    const expectedNonce = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

    // Calculate previous nonce for rolling window grace period
    const prevRawData = `${clientIp}:${c.req.url}:${timeWindow - 1}:${options.serverSecret}`;
    const prevHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(prevRawData));
    const prevNonce = Array.from(new Uint8Array(prevHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

    if (!authHeader || !authHeader.startsWith('XMR402')) {
      c.header('WWW-Authenticate', `XMR402 address="${options.walletAddress}", amount="${options.amountPiconero}", message="${expectedNonce}"`);
      return c.json({ error: 'TACTICAL_PAYMENT_REQUIRED', protocol: 'XMR402' }, 402);
    }

    const matches = authHeader.match(AUTH_REGEX);
    if (!matches || matches.length !== 3) return c.json({ error: 'INVALID_XMR402_FORMAT' }, 400);

    // Check both current and previous nonces
    const isCurrentValid = await verifyProofOnChain(options, matches[1], matches[2], expectedNonce);
    let isPrevValid = false;

    if (!isCurrentValid) {
      isPrevValid = await verifyProofOnChain(options, matches[1], matches[2], prevNonce);
    }

    const isValid = isCurrentValid || isPrevValid;

    if (!isValid) {
      console.log("[GUARD_FAIL] IP:", clientIp, "Expected Nonce:", expectedNonce, "Prev Nonce:", prevNonce, "TXID:", matches[1]);
      return c.json({ error: 'INVALID_PROOF_OR_FUNDS_MISSING' }, 403);
    }

    await next();
  };
}

/**
 * The best DX Wrapper for RipleyGuard (One-Liner version)
 * Environment variables: XMR_RPC_URL, XMR_WALLET_ADDRESS, XMR_SERVER_SECRET
 */
export function paymentMiddleware(config: PaymentConfig) {
  // 1. Read environment variables (fallback for safety)
  const nodeRpcUrl = process.env.XMR_RPC_URL || 'http://127.0.0.1:18081/json_rpc';
  const walletAddress = process.env.XMR_WALLET_ADDRESS || '';
  const serverSecret = process.env.XMR_SERVER_SECRET || 'default_dev_secret';

  if (!walletAddress) {
    console.warn('[RipleyGuard] Warning: XMR_WALLET_ADDRESS is missing in env.');
  }

  return async (c: Context, next: Next) => {
    // 2.Concatenate the current request's route signature, e.g. "GET /api"
    // Note: If you need exact matching, you may need to use c.req.routePath to get the registered route
    const routeKey = `${c.req.method} ${c.req.path}`;
    const rule = config[routeKey];

    // 3. If no rule is hit, or XMR is not supported, directly pass
    if (!rule || !rule.accepts?.includes('XMR')) {
      return await next();
    }

    // 4. Convert to piconero and summon the underlying engine
    const amountPiconero = Math.floor(rule.amount * 1e12);

    // Reuse our hard-core guard
    const guard = ripleyGuardHono({
      nodeRpcUrl,
      walletAddress,
      amountPiconero,
      serverSecret
    });

    return await guard(c, next);
  };
}