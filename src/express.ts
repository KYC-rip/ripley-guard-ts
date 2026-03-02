import { Request, Response, NextFunction } from 'express';
import { RipleyGuardOptions, AUTH_REGEX, verifyProofOnChain, PaymentConfig } from './core';
import crypto from 'crypto';

const generateExpectedNonce = (req: Request, options: RipleyGuardOptions): string => {
  const timeWindow = Math.floor(Date.now() / (options.expireWindowMs || 60000));
  const data = `${req.ip}:${req.originalUrl}:${timeWindow}:${options.serverSecret}`;
  return crypto.createHmac('sha256', options.serverSecret).update(data).digest('hex').substring(0, 16);
};

export function ripleyGuardExpress(options: RipleyGuardOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers['authorization'];
    const expectedNonce = generateExpectedNonce(req, options);

    // 1. Challenge: No credentials, return 402
    if (!authHeader || !authHeader.startsWith('XMR402')) {
      const challenge = `XMR402 address="${options.walletAddress}", amount="${options.amountPiconero}", message="${expectedNonce}"`;
      res.setHeader('WWW-Authenticate', challenge);
      res.status(402).json({ error: 'TACTICAL_PAYMENT_REQUIRED', protocol: 'XMR402' });
      return;
    }

    // 2. Attempt to break through: Extract TxID and Proof
    const matches = authHeader.match(AUTH_REGEX);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: 'INVALID_XMR402_FORMAT' });
      return;
    }

    const txid = matches[1];
    const proof = matches[2];

    // 3. Call for fire support: Node verification
    const isValid = await verifyProofOnChain(options, txid, proof, expectedNonce);

    if (!isValid) {
      res.status(403).json({ error: 'INVALID_PROOF_OR_FUNDS_MISSING' });
      return;
    }

    // 4. Breakthrough: Release request
    next();
  };
}

/**
 * The best DX Wrapper for RipleyGuard (Express One-Liner version)
 * Automatically absorbs environment variables, locks down routes with one line of code.
 */
export function paymentMiddleware(config: PaymentConfig) {
  // 1. Automatically absorbs environment variables
  const nodeRpcUrl = process.env.XMR_RPC_URL || 'http://127.0.0.1:18081/json_rpc';
  const walletAddress = process.env.XMR_WALLET_ADDRESS || '';
  const serverSecret = process.env.XMR_SERVER_SECRET || 'default_dev_secret';

  if (!walletAddress) {
    console.warn('[RipleyGuard] WARNING: XMR_WALLET_ADDRESS is missing in your .env file.');
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    // 2. Precise sniper route.
    // Note: If dynamic route parameters (e.g. /api/users/:id), here we get the actual path (e.g. /api/users/123)
    // When configuring rules, pay attention to the matching rules
    const routeKey = `${req.method} ${req.path}`;
    const rule = config[routeKey];

    // 3. If not in the protected list, or not receiving XMR, directly pass
    if (!rule || !rule.accepts?.includes('XMR')) {
      return next();
    }

    // 4. Unit conversion
    const amountPiconero = Math.floor(rule.amount * 1e12);

    // 5. Pull the gun, summon the underlying hard-core guard
    const guard = ripleyGuardExpress({
      nodeRpcUrl,
      walletAddress,
      amountPiconero,
      serverSecret
    });

    // 6. Delegate the request to the guard
    return guard(req, res, next);
  };
}