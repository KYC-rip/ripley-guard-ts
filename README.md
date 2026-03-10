# 🛡️ Ripley Guard (TypeScript)

> **XMR402 v2.0**: The first transport-agnostic Monero payment primitive.

Industrial-grade Monero payment gating for modern agents, relays, and APIs. Stateless, anonymous, and built for the sovereign machine economy.

`ripley-guard-ts` is a hyper-lightweight middleware implementation of the **XMR402 Protocol**. Refactored in v2.0 into a decoupled architecture, it now supports payment gating across **HTTP**, **WebSockets**, and **Nostr**.

## ⚡ v2.0 Breakthroughs

* **Transport Agnostic**: One core, multiple gates. HTTP, WebSocket (Relay), or Nostr (NIP-style).
* **Payload Binding (HMAC)**: Cryptographically binds payment challenges to specific request intents (URL, Body, IP) to prevent instruction replacement.
* **Stateless Purity**: Zero database required. Validates 0-conf Monero proofs against any RPC node.
* **Rolling Window**: Native support for rolling time-window nonces to handle network latency in agentic handshakes.

## 📦 Installation

```bash
npm install @kyc-rip/ripley-guard-ts
```

## 🛠️ Decoupled Modules

### 1. HTTP (Hono / Express)
The classic 402 flow for REST APIs. Supports Cloudflare Workers, Node.js, Bun, and Deno.

```typescript
import { ripleyGuardHono } from '@kyc-rip/ripley-guard-ts/hono'

// Mount as middleware
app.use('/intel', ripleyGuardHono({
  nodeRpcUrl: "https://rpc.kyc.rip",
  walletAddress: "888tNkba...",
  amountPiconero: 1000000, // 0.001 XMR
  serverSecret: "tactical_secret"
}))
```

### 2. WebSocket Relay (P2P JSON Frames)
Direct agent-to-agent payment gating using JSON frames.

```typescript
import { ripleyGuardWS } from '@kyc-rip/ripley-guard-ts/ws/adapter'

const gate = ripleyGuardWS(options)

ws.on('message', async (msg) => {
  await gate.handle(ws, msg.toString(), 'client-7', 5000, (intent) => {
    ws.send(`Access granted for ${intent}. Unlocking sovereign stream...`)
  })
})
```

### 3. Nostr Adapter
Default implementation for gated Nostr relays or pay-per-event access.

```typescript
import { NostrXMR402Gate } from '@kyc-rip/ripley-guard-ts/nostr'

const gate = new NostrXMR402Gate({ ...options })

// Issues standardized ["NOTICE", "PAYMENT_REQUIRED: XMR402 ..."]
const [tag, msg] = await gate.createNostrChallenge(pubkey, "EVENT_PUBLISH", 1000)
relay.send(tag, msg)
```

## 🌐 The v2.0 Protocol

`ripley-guard-ts` strictly adheres to the XMR402 v2.0 specification:

1. **CHALLENGE**: Server issues a transport-specific challenge (HTTP 402 / JSON Frame) containing `address`, `amount`, `message` (nonce), and `timestamp`.
2. **PROOF**: Client initiates a Monero TX and provides a cryptographic proof (TX Proof) via the `Authorization` header or PROOF frame.
3. **VERIFY**: Server validates the proof against the blockchain mempool (0-conf) and the bound intent.

For the full specification, visit [XMR402.org](https://xmr402.org).

For full integration details, see our [Examples Directory](./src/examples).

## License

MIT © [XBToshi](https://x.com/xbtoshi) / [KYC.rip](https://kyc.rip)
