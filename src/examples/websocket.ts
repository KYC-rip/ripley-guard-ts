import { ripleyGuardWS } from '../ws/adapter';

/**
 * XMR402 WebSocket Example (v2.0)
 * 
 * Demonstrates the "Extreme DX" adapter for P2P agentic handshakes.
 * Uses a mock WebSocket interface for demonstration.
 */

const options = {
  walletAddress: "888tNkbaB65ad3hgE9R916PP56bdz1c9v...", // Your Monero Address
  serverSecret: "tactical_v2_secret",
  nodeRpcUrl: "https://rpc.kyc.rip"
};

const gate = ripleyGuardWS(options);
const amount = 1000000; // 0.001 XMR

// Mock WebSocket implementation
const mockWS = {
  send: (data: string) => {
    console.log("OUTGOING_FRAME:", JSON.parse(data));
  },
  on: (event: string, callback: (msg: string) => void) => {
    // Simulate incoming messages
    if (event === 'message') {
      console.log("SIMULATING_CLIENT_REQUEST...");
      callback(JSON.stringify({ intent: "SECRET_DATA_ACCESS" }));
    }
  }
};

mockWS.on('message', async (msg) => {
  const clientId = "agent-alpha-01";
  
  await gate.handle(mockWS, msg, clientId, amount, (intent) => {
    console.log(`ACCESS_GRANTED: Unlocking stream for ${intent}`);
    mockWS.send(JSON.stringify({ 
      type: "DATA_STREAM", 
      payload: "Sovereign Intelligence Transmission..." 
    }));
  });
});
