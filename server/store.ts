/**
 * Disk persistence for Gear Ask Board.
 * data/board.json — live open questions
 * data/replies/YYYY-MM-DD.json — closed daily archives
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA = path.join(ROOT, 'data')
const BOARD_PATH = path.join(DATA, 'board.json')
const REPLIES_DIR = path.join(DATA, 'replies')

export interface AskMessage {
  id: string
  text: string
  wallet: string
  basename: string | null
  createdAt: string
  paymentRef?: string | null
}

export interface ArchivedAsk extends AskMessage {
  reply: string
}

export interface ReplyArchive {
  date: string
  closedAt: string
  items: ArchivedAsk[]
}

function ensureDirs(): void {
  fs.mkdirSync(REPLIES_DIR, { recursive: true })
  if (!fs.existsSync(BOARD_PATH)) {
    fs.writeFileSync(BOARD_PATH, '[]\n', 'utf8')
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw.trim()) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureDirs()
  const tmp = `${filePath}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8')
  fs.renameSync(tmp, filePath)
}

export function getBoard(): AskMessage[] {
  ensureDirs()
  return readJsonFile<AskMessage[]>(BOARD_PATH, [])
}

export function addAsk(opts: {
  text: string
  wallet: string
  basename: string | null
  paymentRef?: string | null
}): AskMessage {
  ensureDirs()
  const board = getBoard()
  const msg: AskMessage = {
    id: randomUUID(),
    text: opts.text,
    wallet: opts.wallet.toLowerCase(),
    basename: opts.basename,
    createdAt: new Date().toISOString(),
    paymentRef: opts.paymentRef ?? null,
  }
  board.push(msg)
  writeJsonFile(BOARD_PATH, board)
  return msg
}

export function listReplyDates(): string[] {
  ensureDirs()
  const files = fs.readdirSync(REPLIES_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  return files
    .map((f) => f.replace(/\.json$/, ''))
    .sort((a, b) => b.localeCompare(a))
}

export function getRepliesForDate(date: string): ReplyArchive | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  ensureDirs()
  const filePath = path.join(REPLIES_DIR, `${date}.json`)
  if (!fs.existsSync(filePath)) return null
  return readJsonFile<ReplyArchive | null>(filePath, null)
}

export function dailyClose(opts: {
  date?: string
  replies: Array<{ id: string; reply: string }>
}): ReplyArchive {
  ensureDirs()
  const date =
    opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date)
      ? opts.date
      : new Date().toISOString().slice(0, 10)

  const board = getBoard()
  const replyMap = new Map(
    opts.replies.map((r) => [r.id, (r.reply ?? '').trim().slice(0, 500)]),
  )

  const items: ArchivedAsk[] = board.map((q) => ({
    ...q,
    reply: replyMap.get(q.id) || '(no reply)',
  }))

  // Also include any reply ids not on board? Prefer board-only for clear close.
  const archive: ReplyArchive = {
    date,
    closedAt: new Date().toISOString(),
    items,
  }

  const existing = getRepliesForDate(date)
  if (existing) {
    // Merge: append new items, keep prior
    archive.items = [...existing.items, ...items]
  }

  writeJsonFile(path.join(REPLIES_DIR, `${date}.json`), archive)
  writeJsonFile(BOARD_PATH, [])
  return archive
}

export function searchAll(q: string): {
  live: AskMessage[]
  archives: Array<{ date: string; items: ArchivedAsk[] }>
} {
  const needle = q.trim().toLowerCase()
  if (!needle) return { live: [], archives: [] }

  const matchAsk = (m: AskMessage) => {
    const bn = (m.basename || '').toLowerCase()
    const w = (m.wallet || '').toLowerCase()
    return bn.includes(needle) || w.includes(needle) || needle.includes(w)
  }

  const live = getBoard().filter(matchAsk)
  const archives: Array<{ date: string; items: ArchivedAsk[] }> = []
  for (const date of listReplyDates()) {
    const arch = getRepliesForDate(date)
    if (!arch) continue
    const items = arch.items.filter(matchAsk)
    if (items.length) archives.push({ date, items })
  }
  return { live, archives }
}

export function displayLabel(wallet: string, basename: string | null): string {
  if (basename && basename.trim()) return basename.trim()
  const a = wallet.startsWith('0x') ? wallet.slice(2) : wallet
  if (a.length < 8) return wallet
  return `0x${a.slice(0, 4)}…${a.slice(-4)}`
}
