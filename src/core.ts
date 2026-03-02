export interface RipleyGuardOptions {
  nodeRpcUrl: string;
  walletAddress: string;
  amountPiconero: number;
  serverSecret: string;
  expireWindowMs?: number;
}

export interface PaymentRule {
  accepts: string[];
  amount: number; // Normal XMR amount
}

export type PaymentConfig = Record<string, PaymentRule>;

export const AUTH_REGEX = /^XMR402\s+txid="([^"]+)",\s*proof="([^"]+)"$/;

export const verifyProofOnChain = async (options: RipleyGuardOptions, txid: string, proof: string, message: string): Promise<boolean> => {
  try {
    const response = await fetch(options.nodeRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'ripley-guard-hono',
        method: 'check_tx_proof',
        params: {
          txid,
          address: options.walletAddress,
          message,
          signature: proof
        }
      })
    })

    const data: any = await response.json()

    if (data.result?.good === true && data.result?.received >= options.amountPiconero) {
      return true
    }
    return false
  } catch (error) {
    console.error('[RipleyGuard] RPC Uplink offline:', error)
    return false
  }
}