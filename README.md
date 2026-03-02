# 🛡️ Ripley Guard (TypeScript)

> Industrial-grade Monero payment gating for modern APIs. IETF-compliant, 0-conf enabled, and built for the sovereign internet.

Drop the bloated payment processors. `ripley-guard-ts` is a hyper-lightweight, stateless middleware for Hono, Express, and Edge runtimes (Cloudflare Workers/Bun). It implements the **XMR402 Protocol**, locking your API resources behind cryptographic Monero proofs.

**Keywords:** `monero`, `xmr`, `xmr402`, `http-402`, `ai-agents`, `m2m-payments`, `crypto-gateway`, `hono`, `express`

## ⚡ Features

* **Stateless Architecture**: Zero databases. Cryptographic nonce generation prevents replay attacks entirely in memory.
* **IETF Compliant**: Native HTTP 402 flow using standard `WWW-Authenticate` and `Authorization` headers.
* **0-Conf Verification**: Instant resource unlocking using Monero's `check_tx_proof`. Millisecond access.
* **Agent Native**: Speaks the exact machine-readable protocol autonomous AI entities expect.
* **Universal Exports**: Dual exported for both Edge (Hono) and Node.js (Express).

## 📦 Installation

```bash
npm install @kyc-rip/ripley-guard-ts

```

## 🔥 Extreme DX (The One-Liner)

Want absolute simplicity? Use the high-order wrapper. Load your secrets into `.env` (`XMR_RPC_URL`, `XMR_WALLET_ADDRESS`, `XMR_SERVER_SECRET`) and lock down specific routes in one line.

```typescript
import { Hono } from 'hono'
import { paymentMiddleware } from '@kyc-rip/ripley-guard-ts/hono'

const app = new Hono()

// Map routes to XMR prices. Boom. Done.
app.use('*', paymentMiddleware({
  "GET /api/classified": { accepts: ["XMR"], amount: 0.05 },
  "POST /api/generate": { accepts: ["XMR"], amount: 0.1 }
}))

app.get('/api/classified', (c) => c.json({ data: "Sovereign Content Unlocked" }))

```

*(Works exactly the same for Express via `@kyc-rip/ripley-guard-ts/express`)*

## 🚀 Core API Usage

Need more control? Drop down to the core middleware.

### For Hono (Edge / Bun / Cloudflare)

```typescript
import { Hono } from 'hono'
import { ripleyGuardHono } from '@kyc-rip/ripley-guard-ts/hono'

const app = new Hono()

// Mount the tactical gateway
const xmr402Gate = ripleyGuardHono({
  nodeRpcUrl: "[http://127.0.0.1:18081/json_rpc](http://127.0.0.1:18081/json_rpc)",
  walletAddress: "888tNkbaB65ad3hgE9R916PP56bdz1c9v...", 
  amountPiconero: 5000000000, // 0.005 XMR
  serverSecret: process.env.GUARD_SECRET // Used for stateless nonce generation
})

// Protect your sovereign resources
app.get('/api/classified', xmr402Gate, (c) => {
  return c.json({ data: "Sovereign Content Unlocked" })
})

```

### For Express (Node.js)

```typescript
import express from 'express'
import { ripleyGuardExpress } from '@kyc-rip/ripley-guard-ts/express'

const app = express()

const xmr402Gate = ripleyGuardExpress({
  nodeRpcUrl: "[http://127.0.0.1:18081/json_rpc](http://127.0.0.1:18081/json_rpc)",
  walletAddress: "888tNkbaB65ad3hgE9R916PP56bdz1c9v...",
  amountPiconero: 5000000000,
  serverSecret: process.env.GUARD_SECRET
})

app.get('/api/classified', xmr402Gate, (req, res) => {
  res.json({ data: "Sovereign Content Unlocked" })
})

```

## ⚙️ Advanced Configuration

Need dynamic addresses for high-value clients? Pass a function to `walletAddress` to handle routing on the fly:

```typescript
ripleyGuardHono({
  nodeRpcUrl: "[https://rpc.kyc.rip/json_rpc](https://rpc.kyc.rip/json_rpc)",
  amountPiconero: 1000000000000, // 1 XMR
  serverSecret: "super_secret_salt",
  // Fetch a unique subaddress per request
  walletAddress: async (reqInfo) => {
    return await myDatabase.getSubaddressForClient(reqInfo.ip)
  }
})

```

## 🌐 The Protocol

`ripley-guard-ts` strictly adheres to the XMR402 specification:

1. Intercepts unauthorized requests with `HTTP 402 Payment Required`.
2. Issues a `WWW-Authenticate: XMR402 ...` challenge containing the target address, amount, and a cryptographic nonce.
3. Verifies incoming `Authorization: XMR402 txid="...", proof="..."` credentials directly against the Monero blockchain mempool.

For the full machine-to-machine protocol specification, visit [XMR402.org](https://xmr402.org).

## License

MIT © [KYC.rip](https://kyc.rip)
