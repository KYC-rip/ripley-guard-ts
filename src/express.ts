import { Request, Response, NextFunction } from 'express';
import { RipleyGuardOptions, AUTH_REGEX, verifyProofOnChain } from './core';
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