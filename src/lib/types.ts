export interface AskMessage {
  id: string
  text: string
  wallet: string
  basename: string | null
  createdAt: string
  paymentRef?: string | null
  label: string
}

export interface ArchivedAsk extends AskMessage {
  reply: string
}

export interface ReplyArchive {
  date: string
  closedAt: string
  items: ArchivedAsk[]
}

export type View = 'board' | 'replies' | 'reply-date' | 'search'
