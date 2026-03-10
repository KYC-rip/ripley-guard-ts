import { XMR402Relay, XMR402WSOptions } from './relay';

/**
 * Extreme DX WebSocket Adapter for XMR402 (v2.0)
 * 
 * Automatically handles the CHALLENGE/PROOF handshake for any 
 * standard WebSocket-like object.
 */
export function ripleyGuardWS(options: XMR402WSOptions) {
  const relay = new XMR402Relay(options);

  return {
    /**
     * Handles an incoming message frame. 
     * If it's a request, it sends a challenge.
     * If it's a proof, it verifies and calls onGrant.
     */
    handle: async (
      ws: { send: (data: string) => void }, 
      message: string, 
      clientId: string,
      amountPiconero: number,
      onGrant: (intent: string) => void
    ) => {
      try {
        const frame = JSON.parse(message);

        if (frame.type === 'PAYMENT_PROOF') {
          const result = await relay.verifyProof(frame, amountPiconero);
          if (result.success) {
            onGrant(frame.message || 'DEFAULT_INTENT');
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: result.error || 'INVALID_PROOF' }));
          }
        } else {
          // Assume any other message is an intent request
          const challenge = await relay.createChallenge(clientId, frame.intent || 'DEFAULT_INTENT', amountPiconero);
          ws.send(JSON.stringify(challenge));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'INVALID_JSON_FRAME' }));
      }
    }
  };
}
