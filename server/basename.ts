/**
 * Best-effort Basename / reverse ENS resolution for Base wallets.
 * Failures → null (UI falls back to 0xABCD…WXYZ).
 *
 * ReverseRegistrar (Base): 0x79ea96012eea67a83431f1701b3dff7e37f9e282
 * L2Resolver: 0xC6d566A56A1aFf6508b41f6c90ff131615583BCD
 */

const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const REVERSE_REGISTRAR = '0x79ea96012eea67a83431f1701b3dff7e37f9e282'
const L2_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD'

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: AbortSignal.timeout(8000),
    })
    const json = (await res.json()) as { result?: string }
    if (!json.result || json.result === '0x') return null
    return json.result
  } catch {
    return null
  }
}

function decodeAbiString(hex: string): string | null {
  try {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex
    if (h.length < 128) return null
    const len = parseInt(h.slice(64, 128), 16)
    if (!Number.isFinite(len) || len <= 0 || len > 128) return null
    const data = h.slice(128, 128 + len * 2)
    const s = Buffer.from(data, 'hex').toString('utf8').replace(/\0/g, '').trim()
    return s || null
  } catch {
    return null
  }
}

function normalizeName(n: string): string {
  const t = n.trim()
  if (!t) return t
  if (t.endsWith('.base.eth') || t.endsWith('.eth')) return t
  return `${t}.base.eth`
}

export async function resolveBasename(
  address: string,
): Promise<string | null> {
  const addr = address.toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return null

  // 1) ensideas reverse (supports .base.eth often)
  try {
    const r = await fetch(`https://api.ensideas.com/ens/resolve/${addr}`, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
    })
    if (r.ok) {
      const j = (await r.json()) as { name?: string | null }
      if (j.name && typeof j.name === 'string' && j.name.trim()) {
        return normalizeName(j.name)
      }
    }
  } catch {
    /* continue */
  }

  // 2) basename.app HTTP (best-effort)
  try {
    const r = await fetch(`https://api.basename.app/v1/address/${addr}`, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
    })
    if (r.ok) {
      const j = (await r.json()) as { name?: string; basename?: string }
      const n = (j.name || j.basename || '').trim()
      if (n) return normalizeName(n)
    }
  } catch {
    /* continue */
  }

  // 3) On-chain reverse: ReverseRegistrar.node(address) → L2Resolver.name(node)
  try {
    const padded = addr.slice(2).padStart(64, '0')
    // node(address) selector 0xb9f0c93d
    const nodeResult = await ethCall(REVERSE_REGISTRAR, `0xb9f0c93d${padded}`)
    if (!nodeResult || nodeResult.length < 66) return null
    const node = nodeResult.slice(2, 66)
    // name(bytes32) on ReverseRegistrar itself often works
    const fromRev = await ethCall(REVERSE_REGISTRAR, `0x691f3431${node}`)
    const decodedRev = fromRev ? decodeAbiString(fromRev) : null
    if (decodedRev) return normalizeName(decodedRev)
    // L2Resolver.name(bytes32)
    const fromRes = await ethCall(L2_RESOLVER, `0x691f3431${node}`)
    const decodedRes = fromRes ? decodeAbiString(fromRes) : null
    if (decodedRes) return normalizeName(decodedRes)
  } catch {
    /* ignore */
  }

  return null
}
