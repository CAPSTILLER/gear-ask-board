/**
 * CAPH / CAPhet TokenAmount pricing for Gear Ask posts.
 *
 * Same pattern as Gear Tracer: AssetAmount (TokenAmount) with atomic CAPH,
 * NOT USDC dollar-strings. Permit2 because CAPhet version() reverts.
 */

export const NETWORK = 'eip155:8453' as const
export const CAPH_DECIMALS = 18

export const DEFAULT_CAPH_TOKEN =
  '0x1d1bcd1459259429accde23e24e1782f83e97ba3' as const
export const DEFAULT_PAY_TO =
  '0xb61f7eb307f6580d6619115b8ef8cfbf693f73ff' as const

export const CAPH_EIP712_NAME = 'CAPhet'

/** PLACEHOLDER atomic (~0.01 CAPH if CAPH≈$1). Cap should set CAPH_USD_PRICE. */
export const PLACEHOLDER_ASK_CAPH_ATOMIC = '10000000000000000' // 1e16

export function env(name: string, fallback?: string): string {
  const v = process.env[name]
  if (v != null && v !== '') return v
  if (fallback !== undefined) return fallback
  throw new Error(`Missing required env: ${name}`)
}

export function getCaphToken(): `0x${string}` {
  return (process.env.CAPH_TOKEN || DEFAULT_CAPH_TOKEN).toLowerCase() as `0x${string}`
}

export function getPayTo(): `0x${string}` {
  return (process.env.PAY_TO || DEFAULT_PAY_TO).toLowerCase() as `0x${string}`
}

export function getAskUsdTarget(): number {
  return Number(process.env.ASK_PRICE_USD ?? '0.01')
}

/**
 * Atomic CAPH for one ask.
 * Prefer CAPH_USD_PRICE → usd/caphUsd * 10^decimals.
 * Else ASK_CAPH_ATOMIC or PLACEHOLDER 1e16.
 */
export function atomicAmountForAsk(): string {
  const usd = getAskUsdTarget()
  const caphUsd = process.env.CAPH_USD_PRICE
  if (caphUsd != null && caphUsd !== '' && Number(caphUsd) > 0) {
    const tokens = usd / Number(caphUsd)
    const atomic = BigInt(Math.floor(tokens * 10 ** CAPH_DECIMALS))
    if (atomic <= 0n) {
      throw new Error('Computed CAPH atomic amount is zero — check CAPH_USD_PRICE')
    }
    return atomic.toString()
  }
  return process.env.ASK_CAPH_ATOMIC || PLACEHOLDER_ASK_CAPH_ATOMIC
}

export function usingPlaceholderAtomic(): boolean {
  return (
    !(process.env.CAPH_USD_PRICE && Number(process.env.CAPH_USD_PRICE) > 0) &&
    !process.env.ASK_CAPH_ATOMIC
  )
}

/** x402 AssetAmount (TokenAmount) for CAPH on Base via Permit2 */
export function caphTokenAmountAsk() {
  return {
    amount: atomicAmountForAsk(),
    asset: getCaphToken(),
    extra: {
      name: CAPH_EIP712_NAME,
      assetTransferMethod: 'permit2' as const,
    },
  }
}

export function priceLabelAsk(): string {
  const usd = getAskUsdTarget()
  const ph = usingPlaceholderAtomic() ? ' · PLACEHOLDER rate' : ''
  return `ASK · ~$${usd.toFixed(2)} in $CAPH${ph}`
}
