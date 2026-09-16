/**
 * Capstiller Gear Ask — x402 pay-to-ask message board (Express)
 *
 * Node host with disk persistence (data/). Serves /api/* + Vite dist/ in prod.
 */

import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import {
  NETWORK,
  atomicAmountForAsk,
  caphTokenAmountAsk,
  getCaphToken,
  getPayTo,
  priceLabelAsk,
  usingPlaceholderAtomic,
} from './pricing.js'
import {
  addAsk,
  dailyClose,
  displayLabel,
  getBoard,
  getRepliesForDate,
  listReplyDates,
  searchAll,
} from './store.js'
import { resolveBasename } from './basename.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.PORT || 4022)
const DEV_BYPASS =
  process.env.X402_DEV_BYPASS === '1' || process.env.X402_DEV_BYPASS === 'true'
const DAILY_CLOSE_SECRET = process.env.DAILY_CLOSE_SECRET || ''
const MAX_ASK = 180

const facilitatorUrl =
  process.env.X402_FACILITATOR_URL ||
  'https://api.cdp.coinbase.com/platform/v2/x402'

const app = express()
app.use(
  cors({
    origin: true,
    exposedHeaders: [
      'PAYMENT-REQUIRED',
      'PAYMENT-RESPONSE',
      'X-Payment-Required',
    ],
  }),
)
app.use(express.json({ limit: '256kb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'gear-ask',
    version: '1.0.0',
    network: NETWORK,
    payTo: getPayTo(),
    caphToken: getCaphToken(),
    facilitatorUrl,
    placeholderPricing: usingPlaceholderAtomic(),
    askAtomic: atomicAmountForAsk(),
    askLabel: priceLabelAsk(),
    askUsd: Number(process.env.ASK_PRICE_USD ?? '0.01'),
    maxAskChars: MAX_ASK,
    openAsks: getBoard().length,
    replyDates: listReplyDates().length,
    devBypass: DEV_BYPASS,
  })
})

app.get('/api/board', (_req, res) => {
  const board = getBoard()
  res.json({
    items: board.map((m) => ({
      ...m,
      label: displayLabel(m.wallet, m.basename),
    })),
  })
})

app.get('/api/replies', (_req, res) => {
  res.json({ dates: listReplyDates() })
})

app.get('/api/replies/:date', (req, res) => {
  const arch = getRepliesForDate(req.params.date)
  if (!arch) {
    res.status(404).json({ error: 'No archive for that date' })
    return
  }
  res.json({
    ...arch,
    items: arch.items.map((m) => ({
      ...m,
      label: displayLabel(m.wallet, m.basename),
    })),
  })
})

app.get('/api/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  if (!q.trim()) {
    res.status(400).json({ error: 'q required' })
    return
  }
  const result = searchAll(q)
  res.json({
    q: q.trim(),
    live: result.live.map((m) => ({
      ...m,
      label: displayLabel(m.wallet, m.basename),
    })),
    archives: result.archives.map((a) => ({
      date: a.date,
      items: a.items.map((m) => ({
        ...m,
        label: displayLabel(m.wallet, m.basename),
      })),
    })),
  })
})

app.get('/api/basename/:address', async (req, res) => {
  const address = req.params.address
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid address' })
    return
  }
  const name = await resolveBasename(address)
  res.json({
    address: address.toLowerCase(),
    basename: name,
    label: displayLabel(address.toLowerCase(), name),
  })
})

const facilitatorClient = new HTTPFacilitatorClient({
  url: facilitatorUrl,
})

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  'eip155:*',
  new ExactEvmScheme(),
)

if (!DEV_BYPASS) {
  app.use(
    paymentMiddleware(
      {
        'POST /api/ask': {
          accepts: [
            {
              scheme: 'exact',
              network: NETWORK,
              payTo: getPayTo(),
              price: () => caphTokenAmountAsk(),
            },
          ],
          description: 'Gear Ask — post a question ($0.01 CAPH)',
          mimeType: 'application/json',
        },
      },
      resourceServer,
    ),
  )
} else {
  console.warn('[x402] X402_DEV_BYPASS enabled — asks are free')
}

app.post('/api/ask', async (req, res) => {
  try {
    const textRaw = typeof req.body?.text === 'string' ? req.body.text : ''
    const text = textRaw.trim()
    const walletRaw =
      typeof req.body?.wallet === 'string' ? req.body.wallet.trim() : ''

    if (!text) {
      res.status(400).json({ error: 'text required' })
      return
    }
    if (text.length > MAX_ASK) {
      res.status(400).json({ error: `text max ${MAX_ASK} characters` })
      return
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletRaw)) {
      res.status(400).json({ error: 'valid wallet address required' })
      return
    }

    const wallet = walletRaw.toLowerCase()
    let basename: string | null = null
    try {
      basename = await resolveBasename(wallet)
    } catch {
      basename = null
    }

    const paymentRef =
      (req.headers['payment-response'] as string | undefined) ||
      (req.headers['x-payment'] as string | undefined) ||
      null

    const msg = addAsk({
      text,
      wallet,
      basename,
      paymentRef: paymentRef ? String(paymentRef).slice(0, 200) : null,
    })

    res.status(201).json({
      ...msg,
      label: displayLabel(msg.wallet, msg.basename),
      priceLabel: priceLabelAsk(),
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    })
  }
})

app.post('/api/daily-close', (req, res) => {
  const secret = req.headers['x-daily-close-secret']
  if (!DAILY_CLOSE_SECRET) {
    res.status(503).json({ error: 'DAILY_CLOSE_SECRET not configured' })
    return
  }
  if (secret !== DAILY_CLOSE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const replies = Array.isArray(req.body?.replies) ? req.body.replies : null
  if (!replies) {
    res.status(400).json({ error: 'body.replies array required' })
    return
  }

  for (const r of replies) {
    if (!r || typeof r.id !== 'string') {
      res.status(400).json({ error: 'each reply needs id' })
      return
    }
    if (typeof r.reply !== 'string') {
      res.status(400).json({ error: 'each reply needs reply string' })
      return
    }
    if (r.reply.trim().length > 500) {
      res.status(400).json({ error: `reply for ${r.id} exceeds 500 chars` })
      return
    }
  }

  const date =
    typeof req.body?.date === 'string' ? req.body.date : undefined

  try {
    const archive = dailyClose({ date, replies })
    res.json({
      ok: true,
      date: archive.date,
      closedAt: archive.closedAt,
      count: archive.items.length,
      boardCleared: true,
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    })
  }
})

// Production: serve Vite build
const dist = path.join(ROOT, 'dist')
app.use(express.static(dist))
app.get(/^(?!\/api).*/, (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next()
  })
})

app.listen(PORT, () => {
  console.log(`[gear-ask-api] http://127.0.0.1:${PORT}`)
  console.log(`  network=${NETWORK} payTo=${getPayTo()}`)
  console.log(`  CAPH=${getCaphToken()} facilitator=${facilitatorUrl}`)
  console.log(
    `  ask=${atomicAmountForAsk()}` +
      (usingPlaceholderAtomic()
        ? ' (PLACEHOLDER — set CAPH_USD_PRICE or ASK_CAPH_ATOMIC)'
        : ''),
  )
})
