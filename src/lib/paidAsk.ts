/**
 * Paid ask flow: 402 challenge → sign → retry (mirrors Tracer paidDownload).
 */

import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import type { ClientEvmSigner } from '@x402/evm'
import type { AskMessage } from './types'

const CAPH =
  (import.meta.env.VITE_CAPH_TOKEN as string | undefined)?.toLowerCase() ||
  '0x1d1bcd1459259429accde23e24e1782f83e97ba3'

export function isDevBypass(): boolean {
  return (
    import.meta.env.VITE_X402_DEV_BYPASS === '1' ||
    import.meta.env.VITE_X402_DEV_BYPASS === 'true'
  )
}

export function askPriceHint(): string {
  return 'ASK · ~$0.01 in $CAPH'
}

function buildPaidFetch(signer: ClientEvmSigner) {
  const client = x402Client.fromConfig({
    schemes: [{ network: 'eip155:*', client: new ExactEvmScheme(signer) }],
    spendControls: {
      allowedAssets: [
        {
          network: 'eip155:8453',
          asset: CAPH,
          maxAmountPerPayment: '1000000000000000000000', // 1000 CAPH
        },
      ],
    },
  })
  return wrapFetchWithPayment(fetch, client)
}

export async function postAsk(opts: {
  text: string
  wallet: string
  signer: ClientEvmSigner | null
  onStatus?: (msg: string) => void
}): Promise<AskMessage> {
  const { text, wallet, signer, onStatus } = opts
  const body = JSON.stringify({ text, wallet })

  if (isDevBypass()) {
    onStatus?.('DEV bypass — posting without payment')
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(
        typeof err.error === 'string' ? err.error : `Ask failed (${res.status})`,
      )
    }
    return (await res.json()) as AskMessage
  }

  if (!signer) {
    throw new Error('Connect a Base wallet to pay in $CAPH')
  }

  onStatus?.(`Paying ${askPriceHint()}…`)
  const paidFetch = buildPaidFetch(signer)
  const res = await paidFetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(
      `Ask failed (${res.status})${t ? `: ${t.slice(0, 200)}` : ''}`,
    )
  }
  onStatus?.('Posted')
  return (await res.json()) as AskMessage
}
