import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { getWalletClient, getPublicClient } from 'wagmi/actions'
import { WalletButton } from './components/WalletButton'
import { walletClientToX402Signer } from './wallet/signer'
import { wagmiConfig, BASE_CHAIN_ID } from './wallet/config'
import { askPriceHint, isDevBypass, postAsk } from './lib/paidAsk'
import type { AskMessage, ArchivedAsk, View } from './lib/types'

const MAX = 180

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function App() {
  const { address, isConnected, chainId } = useAccount()
  const [view, setView] = useState<View>('board')
  const [board, setBoard] = useState<AskMessage[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [archiveItems, setArchiveItems] = useState<ArchivedAsk[]>([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchLive, setSearchLive] = useState<AskMessage[]>([])
  const [searchArch, setSearchArch] = useState<
    Array<{ date: string; items: ArchivedAsk[] }>
  >([])

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch('/api/board')
      if (!res.ok) return
      const j = (await res.json()) as { items: AskMessage[] }
      setBoard(j.items ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  const loadDates = useCallback(async () => {
    try {
      const res = await fetch('/api/replies')
      if (!res.ok) return
      const j = (await res.json()) as { dates: string[] }
      setDates(j.dates ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void loadBoard()
    const t = setInterval(() => void loadBoard(), 15_000)
    return () => clearInterval(t)
  }, [loadBoard])

  useEffect(() => {
    if (view === 'replies') void loadDates()
  }, [view, loadDates])

  async function openDate(date: string) {
    setSelectedDate(date)
    setView('reply-date')
    setArchiveItems([])
    try {
      const res = await fetch(`/api/replies/${date}`)
      if (!res.ok) throw new Error('Failed to load archive')
      const j = (await res.json()) as { items: ArchivedAsk[] }
      setArchiveItems(j.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function runSearch() {
    const q = searchQ.trim()
    if (!q) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('Search failed')
      const j = (await res.json()) as {
        live: AskMessage[]
        archives: Array<{ date: string; items: ArchivedAsk[] }>
      }
      setSearchLive(j.live ?? [])
      setSearchArch(j.archives ?? [])
      setView('search')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitAsk() {
    setError(null)
    setStatus(null)
    const trimmed = text.trim()
    if (!trimmed) {
      setError('Write a question first')
      return
    }
    if (trimmed.length > MAX) {
      setError(`Max ${MAX} characters`)
      return
    }
    if (!isDevBypass() && (!isConnected || !address)) {
      setError('Connect a wallet on Base to ask')
      return
    }
    if (!isDevBypass() && chainId !== BASE_CHAIN_ID) {
      setError('Switch to Base network')
      return
    }

    setBusy(true)
    try {
      let signer = null
      if (!isDevBypass() && address) {
        const wc = await getWalletClient(wagmiConfig, {
          chainId: BASE_CHAIN_ID,
          account: address,
        })
        if (!wc) throw new Error('Wallet client unavailable')
        const pc = getPublicClient(wagmiConfig, { chainId: BASE_CHAIN_ID })
        signer = walletClientToX402Signer(wc, address, pc ?? null)
      }
      const wallet = address || '0x0000000000000000000000000000000000000001'
      await postAsk({
        text: trimmed,
        wallet,
        signer,
        onStatus: setStatus,
      })
      setText('')
      setStatus('Question posted')
      await loadBoard()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-cap-black">
      <header className="border-b border-cap-border bg-cap-zinc/90 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-wide text-cap-gold">
              Gear Ask
            </h1>
            <p className="text-[10px] text-cap-muted truncate">
              Pay {askPriceHint()} · free to view · Axle replies daily
            </p>
          </div>
          <WalletButton />
        </div>
        <nav className="max-w-2xl mx-auto px-4 pb-2 flex gap-2 text-[11px] uppercase tracking-wider">
          <NavBtn active={view === 'board'} onClick={() => setView('board')}>
            Board
          </NavBtn>
          <NavBtn
            active={view === 'replies' || view === 'reply-date'}
            onClick={() => {
              setView('replies')
              setSelectedDate(null)
            }}
          >
            Replies
          </NavBtn>
          <NavBtn
            active={view === 'search'}
            onClick={() => setView('search')}
          >
            Search
          </NavBtn>
        </nav>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 flex flex-col gap-4">
        {error && (
          <div className="text-xs text-amber-300 border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
            {error}
          </div>
        )}
        {status && !error && (
          <div className="text-xs text-cap-gold/90 border border-cap-gold/20 rounded-lg px-3 py-2 bg-cap-gold/5">
            {status}
          </div>
        )}

        {view === 'board' && (
          <>
            <section className="rounded-xl border border-cap-border bg-cap-panel p-3 space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-cap-steel">
                Ask a question
              </label>
              <textarea
                rows={3}
                maxLength={MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's on your mind? (max 180 chars)"
                className="resize-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] tabular-nums ${
                    text.length > MAX - 20 ? 'text-amber-400' : 'text-cap-muted'
                  }`}
                >
                  {text.length}/{MAX}
                  {isDevBypass() ? ' · DEV bypass' : ''}
                </span>
                <button
                  type="button"
                  disabled={busy || !text.trim()}
                  onClick={() => void submitAsk()}
                  className="text-[11px] uppercase tracking-wider text-cap-black bg-cap-gold hover:bg-cap-gold-dim disabled:opacity-40 rounded-md px-3 py-1.5 font-medium"
                >
                  {busy ? 'Working…' : `Pay & ask · $0.01`}
                </button>
              </div>
            </section>

            <section className="flex-1 min-h-0">
              <h2 className="text-[10px] uppercase tracking-wider text-cap-steel mb-2">
                Live board · {board.length} open
              </h2>
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {board.length === 0 && (
                  <p className="text-sm text-cap-muted py-8 text-center">
                    No open questions yet. Be the first.
                  </p>
                )}
                {[...board].reverse().map((m) => (
                  <article
                    key={m.id}
                    className="rounded-lg border border-cap-border bg-cap-zinc px-3 py-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[11px] text-cap-gold font-medium truncate">
                        {m.label}
                      </span>
                      <time className="text-[9px] text-cap-muted shrink-0">
                        {formatTime(m.createdAt)}
                      </time>
                    </div>
                    <p className="text-sm text-[#e8e8e8] whitespace-pre-wrap break-words">
                      {m.text}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {view === 'replies' && (
          <section>
            <h2 className="text-[10px] uppercase tracking-wider text-cap-steel mb-3">
              Closed days
            </h2>
            {dates.length === 0 ? (
              <p className="text-sm text-cap-muted text-center py-10">
                No reply archives yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dates.map((d) => (
                  <li key={d}>
                    <button
                      type="button"
                      onClick={() => void openDate(d)}
                      className="w-full text-left rounded-lg border border-cap-border bg-cap-panel hover:border-cap-gold/40 px-3 py-2.5 text-sm tabular-nums"
                    >
                      {d}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view === 'reply-date' && selectedDate && (
          <section>
            <button
              type="button"
              onClick={() => setView('replies')}
              className="text-[10px] uppercase tracking-wider text-cap-steel hover:text-cap-gold mb-3"
            >
              ← All dates
            </button>
            <h2 className="text-sm text-cap-gold mb-3 tabular-nums">
              {selectedDate}
            </h2>
            <div className="space-y-3 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
              {archiveItems.map((m) => (
                <article
                  key={m.id}
                  className="rounded-lg border border-cap-border bg-cap-zinc overflow-hidden"
                >
                  <div className="px-3 py-2.5 border-b border-cap-border/60">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[11px] text-cap-gold font-medium truncate">
                        {m.label}
                      </span>
                      <time className="text-[9px] text-cap-muted shrink-0">
                        {formatTime(m.createdAt)}
                      </time>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {m.text}
                    </p>
                  </div>
                  <div className="px-3 py-2.5 bg-cap-panel/80">
                    <span className="text-[9px] uppercase tracking-wider text-cap-muted">
                      Axle
                    </span>
                    <p className="text-sm text-cap-steel mt-0.5 whitespace-pre-wrap break-words">
                      {m.reply}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {view === 'search' && (
          <section className="space-y-3">
            <div className="flex gap-2">
              <input
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runSearch()
                }}
                placeholder="Basename or wallet…"
              />
              <button
                type="button"
                disabled={busy || !searchQ.trim()}
                onClick={() => void runSearch()}
                className="shrink-0 text-[11px] uppercase tracking-wider text-cap-gold border border-cap-gold/40 rounded-md px-3 hover:bg-cap-gold/10 disabled:opacity-40"
              >
                Go
              </button>
            </div>
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {searchLive.length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase text-cap-steel mb-2">
                    Live
                  </h3>
                  <div className="space-y-2">
                    {searchLive.map((m) => (
                      <article
                        key={m.id}
                        className="rounded-lg border border-cap-border bg-cap-zinc px-3 py-2"
                      >
                        <span className="text-[11px] text-cap-gold">
                          {m.label}
                        </span>
                        <p className="text-sm mt-1">{m.text}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {searchArch.map((a) => (
                <div key={a.date}>
                  <h3 className="text-[10px] uppercase text-cap-steel mb-2">
                    {a.date}
                  </h3>
                  <div className="space-y-2">
                    {a.items.map((m) => (
                      <article
                        key={m.id}
                        className="rounded-lg border border-cap-border bg-cap-zinc px-3 py-2"
                      >
                        <span className="text-[11px] text-cap-gold">
                          {m.label}
                        </span>
                        <p className="text-sm mt-1">{m.text}</p>
                        <p className="text-sm text-cap-steel mt-1 border-t border-cap-border/50 pt-1">
                          {m.reply}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
              {view === 'search' &&
                searchLive.length === 0 &&
                searchArch.length === 0 &&
                searchQ.trim() !== '' &&
                !busy && (
                  <p className="text-sm text-cap-muted text-center py-6">
                    No matches. Run a search.
                  </p>
                )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-cap-border py-2 text-center text-[9px] text-cap-muted">
        Capstiller · Gear Ask v1 · Base · $CAPH x402
      </footer>

      <a
        className="gear-home-cutout fixed bottom-3 left-1/2 z-40 inline-flex -translate-x-1/2 opacity-90 transition-opacity hover:opacity-100 active:opacity-70 focus-visible:opacity-100"
        href="https://landonthis.gearup.wtf"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Gear home — landonthis"
      >
        <img
          src="/gear-logo-cutout.svg"
          alt=""
          height={56}
          width={213}
          className="h-14 w-auto"
          style={{ imageRendering: 'pixelated' }}
        />
      </a>
    </div>
  )
}

function NavBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md border ${
        active
          ? 'border-cap-gold/50 text-cap-gold bg-cap-gold/10'
          : 'border-transparent text-cap-steel hover:text-cap-gold'
      }`}
    >
      {children}
    </button>
  )
}
