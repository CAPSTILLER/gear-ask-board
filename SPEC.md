# Gear Ask Board (working title)

Pay-to-ask message board for Capstiller / Gear. Free to view everything.

## Payments
- Network: Base mainnet (eip155:8453)
- Token: $CAPH / CAPhet `0x1d1bcd1459259429accde23e24e1782f83e97ba3` (18 decimals)
- Pay to: `0xB61f7Eb307f6580D6619115b8ef8CFbf693F73Ff`
- Price: $0.01 USD worth of CAPH per ask (same TokenAmount/x402 pattern as Gear Tracer — NOT USDC dollar-string). Default atomic placeholder `10000000000000000` (0.01 CAPH) unless `CAPH_USD_PRICE` set.
- No message without successful payment (x402). Dev bypass env for local only.

## Ask rules
- Max 180 characters per prompt (trim; reject over).
- Wallet must be connected; payment proves wallet.
- Store: id, text, wallet (checksum/lower), basename (resolved if any), createdAt ISO, tx/payment ref if available.

## Labels
- If wallet has an **active Basename** on Base → show that Basename.
- Else show `0xABCD…WXYZ` (first 4 + last 4 hex chars after 0x, or first4/last4 of full address consistently).

## UI
1. **Live board** — scroll of open paid asks (message after message). Compose box + wallet connect + pay.
2. **Replies** button → list of **dates** that have closed batches.
3. Tap date → scroll of **question then reply** pairs for that day.
4. **Search** Basename or wallet → find that user's questions (and replies) across live + archives.

## Daily close (Axle routine)
- Once per day: GET open board → batch into one LLM job → reply to each ≤500 chars, complete sentences, no mid-cut.
- Inappropriate asks: funny deflect, don't engage.
- POST close with replies → creates `replies/YYYY-MM-DD` page, **clears live board**.
- Protect close endpoint with `DAILY_CLOSE_SECRET`.

## Stack
- Vite + React frontend (Gear dark aesthetic, simple).
- Express server: static + API + x402 (mirror Tracer packages).
- Persist to `data/board.json` + `data/replies/*.json` (Node host, not Vercel serverless-only).
- Basename resolve: try public Basenames / ENS on Base resolver; cache on message.

## Ship
- README, SHIP.md, .env.example, tar.gz
- Push public GitHub `CAPSTILLER/gear-ask-board` if gh works
