import { Request, Response, NextFunction } from 'express';
import {
  generateNonce,
  verifyPayment,
  hashPayload,
  AUTH_REGEX,
  NonceContext
} from './core';

export interface RipleyGuardOptions {
  nodeRpcUrl: string;
  walletAddress: string;
  amountPiconero: number;
  serverSecret: string;
  expireWindowMs?: number;
}

export function ripleyGuardExpress(options: RipleyGuardOptions) {
  const {
    nodeRpcUrl,
    walletAddress,
    amountPiconero,
    serverSecret,
    expireWindowMs = 300000
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers['authorization'];
    const timestamp = Date.now();
    const timeWindow = Math.floor(timestamp / expireWindowMs);
    const clientIp = req.ip || req.get('x-forwarded-for') || 'unknown-ip';

    // 1. Instruction Binding: Hash the request body
    // If body-parser is used, req.body is an object. We'll stringify it for the hash.
    const bodyText = (req.method === 'GET' || req.method === 'HEAD') ? '' :
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
    const payloadHash = await hashPayload(bodyText);

    const nonceCtx: NonceContext = {
      clientIp,
      url: req.originalUrl,
      payloadHash,
      timestamp: timeWindow.toString()
    };

    // Calculate current and previous nonces
    const expectedNonce = await generateNonce(serverSecret, nonceCtx);
    const prevNonce = await generateNonce(serverSecret, { ...nonceCtx, timestamp: (timeWindow - 1).toString() });

    // 2. Challenge: No credentials, return 402
    if (!authHeader || !authHeader.startsWith('XMR402')) {
      const challenge = `XMR402 address="${walletAddress}", amount="${amountPiconero}", message="${expectedNonce}", timestamp="${timestamp}"`;
      res.setHeader('WWW-Authenticate', challenge);
      res.status(402).json({ error: 'TACTICAL_PAYMENT_REQUIRED', protocol: 'XMR402' });
      return;
    }

    // 3. Extract TxID and Proof
    const matches = authHeader.match(AUTH_REGEX);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: 'INVALID_XMR402_FORMAT' });
      return;
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
      console.log(`[GUARD_FAIL] IP: ${clientIp} URL: ${req.originalUrl} TXID: ${txid}`);
      res.status(403).json({ error: 'INVALID_PROOF_OR_FUNDS_MISSING' });
      return;
    }

    next();
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

  return async (req: Request, res: Response, next: NextFunction) => {
    const routeKey = `${req.method} ${req.path}`;
    const rule = config[routeKey];

    if (!rule || !rule.accepts?.includes('XMR')) {
      return next();
    }

    const amountPiconero = Math.floor(rule.amount * 1e12);

    const guard = ripleyGuardExpress({
      nodeRpcUrl,
      walletAddress,
      amountPiconero,
      serverSecret
    });

    return guard(req, res, next);
  };
}