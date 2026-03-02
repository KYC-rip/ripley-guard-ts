import { Context, Next } from 'hono';
import { RipleyGuardOptions, AUTH_REGEX, verifyProofOnChain } from './core';

export function ripleyGuardHono(options: RipleyGuardOptions) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const timeWindow = Math.floor(Date.now() / (options.expireWindowMs || 60000));
    const clientIp = c.req.header('x-forwarded-for') || 'unknown-ip';
    const rawData = `${clientIp}:${c.req.url}:${timeWindow}:${options.serverSecret}`;

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawData));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedNonce = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

    if (!authHeader || !authHeader.startsWith('XMR402')) {
      c.header('WWW-Authenticate', `XMR402 address="${options.walletAddress}", amount="${options.amountPiconero}", message="${expectedNonce}"`);
      return c.json({ error: 'TACTICAL_PAYMENT_REQUIRED', protocol: 'XMR402' }, 402);
    }

    const matches = authHeader.match(AUTH_REGEX);
    if (!matches || matches.length !== 3) return c.json({ error: 'INVALID_XMR402_FORMAT' }, 400);

    const isValid = await verifyProofOnChain(options, matches[1], matches[2], expectedNonce);
    if (!isValid) return c.json({ error: 'INVALID_PROOF_OR_FUNDS_MISSING' }, 403);

    await next();
  };
}