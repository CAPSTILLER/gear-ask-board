# Gear Ask

Pay-to-ask message board for Capstiller / Gear. **Free to view** everything. Posting costs **~$0.01 in $CAPH** on Base via [x402](https://x402.org).

## Product

- **Ask** — connect a Base wallet, write ≤180 chars, pay $CAPH → question appears on the live board.
- **Board** — scroll of open paid questions. Labels show Basename when active, else `0xABCD…WXYZ`.
- **Replies** — list of closed dates; tap a date for Q → Axle reply pairs.
- **Search** — basename or wallet across live board + archives.
- **Daily close** — Axle (or ops) `POST /api/daily-close` with replies → dated archive + **clears** the live board. Secret-protected.

Inappropriate handling lives in Axle’s routine prompt, not a server content filter (empty-check only).

## Stack

- Vite + React + TypeScript frontend (dark Gear UI)
- Express + TypeScript (`tsx`) API with `@x402/express`
- Disk store: `data/board.json` + `data/replies/YYYY-MM-DD.json`
- wagmi / viem wallet connect (injected + Coinbase)

**Deploy on a Node host** (Railway, Fly, VPS). Not Vercel-only — needs a persistent filesystem for `data/`.

## Quick start

```bash
cp .env.example .env
# For local free posting:
#   X402_DEV_BYPASS=1
#   VITE_X402_DEV_BYPASS=1
#   DAILY_CLOSE_SECRET=dev-local-secret

npm install
npm run dev          # API :4022 + Vite (proxies /api)
```

Production:

```bash
npm install
npm run build
# set real .env (CAPH_USD_PRICE or ASK_CAPH_ATOMIC, DAILY_CLOSE_SECRET, facilitator)
npm start            # Express serves /api/* + dist/ on PORT (default 4022)
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | API + Vite concurrently |
| `npm run dev:api` | Express only (`tsx server/index.ts`) |
| `npm run dev:web` | Vite only |
| `npm run build` | Typecheck client + Vite build → `dist/` |
| `npm start` | Production server (API + static) |
| `npm run typecheck` | Client + server `tsc` |

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | Pricing + status |
| GET | `/api/board` | Live open asks |
| GET | `/api/replies` | List of archive dates |
| GET | `/api/replies/:date` | Q+reply archive for date |
| GET | `/api/search?q=` | Basename / wallet search |
| GET | `/api/basename/:address` | Best-effort Basename resolve |
| POST | `/api/ask` | **x402** body `{ text, wallet }` |
| POST | `/api/daily-close` | Header `X-Daily-Close-Secret`; body `{ date?, replies: [{ id, reply }] }` |

## Payments

- Network: Base (`eip155:8453`)
- Token: $CAPH / CAPhet `0x1d1bcd1459259429accde23e24e1782f83e97ba3` (18 decimals, Permit2)
- Pay to: `0xB61f7Eb307f6580D6619115b8ef8CFbf693F73Ff`
- Price: `ASK_PRICE_USD=0.01` worth of CAPH (TokenAmount — **not** USDC dollar-string)

See **SHIP.md** for Cap’s runbook, facilitator notes, and env table.

## License

Private / Capstiller — all rights reserved unless otherwise noted.
