import { Context, Next } from 'hono'

export interface RipleyGuardOptions {
  nodeRpcUrl: string        // Monero RPC 节点地址
  walletAddress: string     // 你的收款子地址
  amountPiconero: number    // XMR 价格 (原子单位)
  serverSecret: string      // Edge 环境下的哈希盐
  expireWindowMs?: number   // Nonce 有效期，默认 5 分钟
}

const AUTH_REGEX = /^XMR402\s+txid="([^"]+)",\s*proof="([^"]+)"$/

export function ripleyGuard(options: RipleyGuardOptions) {
  const {
    nodeRpcUrl,
    walletAddress,
    amountPiconero,
    serverSecret,
    expireWindowMs = 300000
  } = options

  // 节点验证逻辑
  const verifyProofOnChain = async (txid: string, proof: string, message: string): Promise<boolean> => {
    try {
      const response = await fetch(nodeRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'ripley-guard-hono',
          method: 'check_tx_proof',
          params: {
            txid,
            address: walletAddress,
            message,
            signature: proof
          }
        })
      })

      const data = await response.json()

      if (data.result?.good === true && data.result?.received >= amountPiconero) {
        return true // 资金到位，准备放行
      }
      return false
    } catch (error) {
      console.error('[RipleyGuard] RPC Uplink offline:', error)
      return false
    }
  }

  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization')

    // 动态生成 Edge 原生 Nonce
    const timeWindow = Math.floor(Date.now() / expireWindowMs)
    const clientIp = c.req.header('x-forwarded-for') || 'unknown-ip'
    const rawData = `${clientIp}:${c.req.url}:${timeWindow}:${serverSecret}`

    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawData))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const expectedNonce = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)

    // 1. 遭遇战：没带凭证，下发 402 挑战头
    if (!authHeader || !authHeader.startsWith('XMR402')) {
      const challenge = `XMR402 address="${walletAddress}", amount="${amountPiconero}", message="${expectedNonce}"`
      c.header('WWW-Authenticate', challenge)
      return c.json({ error: 'TACTICAL_PAYMENT_REQUIRED', protocol: 'XMR402' }, 402)
    }

    // 2. 破墙尝试：解析 Authorization
    const matches = authHeader.match(AUTH_REGEX)
    if (!matches || matches.length !== 3) {
      return c.json({ error: 'INVALID_XMR402_FORMAT' }, 400)
    }

    const txid = matches[1]
    const proof = matches[2]

    // 3. 呼叫火力支援：验证凭证
    const isValid = await verifyProofOnChain(txid, proof, expectedNonce)

    if (!isValid) {
      return c.json({ error: 'INVALID_PROOF_OR_FUNDS_MISSING' }, 403)
    }

    // 4. 防线突破：交接给下一个路由
    await next()
  }
}