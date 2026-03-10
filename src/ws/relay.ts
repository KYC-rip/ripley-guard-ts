import { 
  generateNonce, 
  verifyPayment, 
  NonceContext 
} from '../core';

export interface XMR402WSOptions {
  walletAddress: string;
  serverSecret: string;
  nodeRpcUrl: string;
}

export type XMR402Frame = 
  | { type: 'PAYMENT_CHALLENGE'; address: string; amount: string; message: string; timestamp: string }
  | { type: 'PAYMENT_PROOF'; txid: string; proof: string; message?: string };

/**
 * Handles the XMR402 JSON-based Relay Protocol (v2.0)
 */
export class XMR402Relay {
  constructor(private options: XMR402WSOptions) {}

  /**
   * Generates a challenge frame for a specific client/request
   */
  async createChallenge(clientId: string, intent: string, amountPiconero: number): Promise<XMR402Frame> {
    const timestamp = Date.now();
    const timeWindow = Math.floor(timestamp / 300000);
    
    const nonceCtx: NonceContext = {
      clientIp: clientId,
      url: 'ws://relay', // Virtual path for WS relay
      payloadHash: intent,
      timestamp: timeWindow.toString()
    };

    const message = await generateNonce(this.options.serverSecret, nonceCtx);

    return {
      type: 'PAYMENT_CHALLENGE',
      address: this.options.walletAddress,
      amount: amountPiconero.toString(),
      message,
      timestamp: timestamp.toString()
    };
  }

  /**
   * Verifies proof from a client response frame
   */
  async verifyProof(frame: XMR402Frame, minAmount: number): Promise<{ success: boolean; error?: string }> {
    if (frame.type !== 'PAYMENT_PROOF') {
      return { success: false, error: 'INVALID_FRAME_TYPE' };
    }

    const { txid, proof, message } = frame;
    if (!txid || !proof || !message) {
      return { success: false, error: 'MISSING_PAYLOAD' };
    }

    return await verifyPayment(this.options.nodeRpcUrl, {
      txid,
      address: this.options.walletAddress,
      message,
      signature: proof,
      minAmount
    });
  }
}
