# SHIP — Capstiller Gear Ask v1

Short runbook for Cap.

## What shipped

- Pay-to-ask board: `POST /api/ask` gated by x402 Exact on Base ($CAPH TokenAmount ≈ $0.01)
- Free reads: board, replies by date, search, basename helper
- Disk persistence: `data/board.json` + `data/replies/YYYY-MM-DD.json`
- Daily close: `POST /api/daily-close` + `X-Daily-Close-Secret` → archive + clear board
- Wallet connect (injected + Coinbase) on Base; paid flow mirrors Gear Tracer (`@x402/fetch`)
- Version **1.0.0** · app title **Gear Ask**

## Env vars

Copy `.env.example` → `.env`.

| Var | Purpose |
|-----|---------|
| `PAY_TO` | `0xB61f7Eb307f6580D6619115b8ef8CFbf693F73Ff` |
| `CAPH_TOKEN` | `0x1d1bcd1459259429accde23e24e1782f83e97ba3` |
| `ASK_PRICE_USD` | Label target `0.01` |
| `CAPH_USD_PRICE` | **Set this** for real economics: atomic = usd/price × 10¹⁸ |
| `ASK_CAPH_ATOMIC` | Explicit atomic string if no USD rate |
| `X402_FACILITATOR_URL` | CDP default or PayAI `https://facilitator.payai.network` |
| `X402_DEV_BYPASS=1` | API skips x402 (local only) |
| `VITE_X402_DEV_BYPASS=1` | Client posts without payment |
| `DAILY_CLOSE_SECRET` | Required for Axle close endpoint |
| `BASE_RPC_URL` | Optional; Basename reverse lookup (default `https://mainnet.base.org`) |
| `PORT` | Default `4022` |

Verified on-chain (same as Tracer): `name()=CAPhet`, `symbol()=CAPH`, `decimals()=18`, `version()` reverts → **Permit2**.

**PLACEHOLDER:** if neither `CAPH_USD_PRICE` nor `ASK_CAPH_ATOMIC` is set, server uses `1e16` atomic (only meaningful if CAPH≈$1).

## Deploy path (Node — required)

Needs a **persistent disk** for `data/`. Do **not** deploy as pure Vercel serverless without external storage.

```bash
npm install
npm run build
# set .env (CAPH_USD_PRICE, DAILY_CLOSE_SECRET, facilitator, unset DEV_BYPASS)
npm start              # Express on :4022 serves /api/* + dist/
```

Railway / Fly / VPS + reverse proxy. Mount or keep `data/` across restarts (and back it up).

### Local dev

```bash
npm install
# .env with X402_DEV_BYPASS=1, VITE_X402_DEV_BYPASS=1, DAILY_CLOSE_SECRET=…
npm run dev            # API :4022 + Vite (proxies /api)
```

### Vercel note

Not the primary path. Ephemeral FS loses `board.json` / archives. If you insist, put `data/` on S3/R2/Redis and adapt `server/store.ts` — out of scope for v1.

## Axle daily close

1. `GET /api/board` → open asks
2. LLM replies ≤500 chars each (complete sentences; funny deflect for inappropriate — in **prompt**, not server)
3. Close:

```bash
curl -sS -X POST http://127.0.0.1:4022/api/daily-close \
  -H "Content-Type: application/json" \
  -H "X-Daily-Close-Secret: $DAILY_CLOSE_SECRET" \
  -d '{"date":"2026-09-16","replies":[{"id":"<uuid>","reply":"…"}]}'
```

Creates/merges `data/replies/YYYY-MM-DD.json` and **clears** the live board.

## Test one paid ask

1. Set `CAPH_USD_PRICE` (or `ASK_CAPH_ATOMIC`). Unset `X402_DEV_BYPASS` / `VITE_X402_DEV_BYPASS`.
2. Facilitator works (PayAI for clean 402s without CDP auth).
3. Fund wallet with CAPH + a little ETH (Permit2 gas).
4. `npm run build && npm start` (or `npm run dev` without bypass).
5. Connect wallet → compose → Pay & ask → see post on board.

Unpaid probe:

```bash
curl -i http://127.0.0.1:4022/api/health
curl -i -X POST http://127.0.0.1:4022/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"text":"hi","wallet":"0x0000000000000000000000000000000000000001"}'
# expect HTTP 402 when bypass is off
```

## Facilitator note (from Tracer)

- CDP mainnet URL may **401** without credentials → middleware can surface 500 instead of clean 402.
- PayAI `https://facilitator.payai.network` returned proper **402** with CAPH AssetAmount in Tracer smoke tests.
- Prefer PayAI until CDP auth is wired: `X402_FACILITATOR_URL=https://facilitator.payai.network`

## Blockers Cap should expect

1. **CDP facilitator auth** — or switch to PayAI.
2. **Permit2 approval** for CAPH on first payment.
3. **CAPH market price** — set `CAPH_USD_PRICE` or `ASK_CAPH_ATOMIC` explicitly.
4. **Persistent Node disk** for `data/` — not serverless-only.
5. **DAILY_CLOSE_SECRET** — must be set in production before Axle can close.
