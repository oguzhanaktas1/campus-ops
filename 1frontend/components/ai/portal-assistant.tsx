'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bot, ChevronDown, Loader2, MessageCircleMore, SendHorizonal, Sparkles, X } from 'lucide-react'

import { getToken, getStoredUser, resolvePrimaryRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
  links?: Array<{ label: string; href: string }>
  cards?: Array<{ type: string; label: string; value: string | number; description?: string | null }>
}

type PortalAssistantProps = {
  portal: 'student' | 'faculty' | 'staff' | 'admin' | 'organizer'
  title: string
  description: string
  prompts: string[]
}

function buildSessionKey(portal: string) {
  return `campusops-ai-session:${portal}`
}

function ensureSessionId(portal: string) {
  const key = buildSessionKey(portal)
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const next = `ai-${portal}-${crypto.randomUUID()}`
  sessionStorage.setItem(key, next)
  return next
}

export function PortalAssistant({
  portal,
  title,
  description,
  prompts,
}: PortalAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const messagesRef = useRef<HTMLDivElement | null>(null)

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const role = useMemo(() => resolvePrimaryRole(getStoredUser()), [])

  useEffect(() => {
    const checkHealth = async () => {
      const token = getToken()
      if (!token) {
        setIsChecking(false)
        return
      }

      try {
        const res = await fetch(`${backendUrl}/ai/health`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          setIsChecking(false)
          return
        }

        const data = await res.json()
        setIsEnabled(data.enabled === true && data.status !== 'unavailable' && data.status !== 'disabled')
      } catch {
        setIsEnabled(false)
      } finally {
        setIsChecking(false)
      }
    }

    void checkHealth()
  }, [backendUrl])

  useEffect(() => {
    if (!isOpen || !messagesRef.current) return
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [isOpen, messages, isSending])

  const submitMessage = async (message: string) => {
    const trimmed = message.trim()
    const token = getToken()
    if (!trimmed || !token) return

    const sessionId = ensureSessionId(portal)
    const nextUserMessage: AssistantMessage = { role: 'user', content: trimmed }
    setMessages((current) => [...current, nextUserMessage])
    setInput('')
    setIsSending(true)

    try {
      const res = await fetch(`${backendUrl}/ai/assistant/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          portal,
          message: trimmed,
          sessionId,
        }),
      })

      if (!res.ok) {
        throw new Error('Assistant request failed')
      }

      const data = await res.json()
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.answer || 'AI assistant is currently unavailable.',
          links: Array.isArray(data.links) ? data.links : [],
          cards: Array.isArray(data.cards) ? data.cards : [],
        },
      ])
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'AI assistant is currently unavailable.',
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  if (isChecking) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          type="button"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-lg"
          aria-label="Checking AI assistant availability"
          disabled
        >
          <Loader2 className="size-5 animate-spin" />
        </button>
      </div>
    )
  }

  if (!isEnabled || !role) {
    return null
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {isOpen && (
        <div className="pointer-events-auto w-[calc(100vw-1rem)] max-w-sm overflow-hidden rounded-[1.5rem] border border-border/80 bg-background/95 shadow-2xl backdrop-blur">
          <div className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-background to-background px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                    <Bot className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-[11px] text-muted-foreground">AI helper only. Final action stays with you.</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                  <Sparkles className="size-3" />
                  {portal}
                </div>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close AI assistant"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3">
            <div className="flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto rounded-full px-3 py-1.5 text-[11px]"
                  onClick={() => void submitMessage(prompt)}
                  disabled={isSending}
                >
                  {prompt}
                </Button>
              ))}
            </div>

            <div
              ref={messagesRef}
              className="h-80 space-y-3 overflow-y-auto rounded-2xl border border-border/70 bg-muted/20 p-3"
            >
              {messages.length === 0 ? (
                <div className="space-y-2 rounded-2xl border border-dashed border-border bg-background/90 p-3 text-sm text-muted-foreground">
                  <p>This session starts empty every time. Previous chats are not reloaded into the UI.</p>
                  <p>Ask about routes, request status, approvals, analytics, or next steps.</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={message.role === 'user' ? 'ml-auto max-w-[85%]' : 'max-w-[90%]'}
                  >
                    <div
                      className={
                        message.role === 'user'
                          ? 'rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground'
                          : 'rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2 text-sm text-foreground'
                      }
                    >
                      {message.content}
                    </div>
                    {!!message.links?.length && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.links.map((link) => (
                          <Link
                            key={`${link.href}-${link.label}`}
                            href={link.href}
                            className="text-xs font-medium text-primary underline underline-offset-4"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    )}
                    {!!message.cards?.length && (
                      <div className="mt-2 grid gap-2">
                        {message.cards.map((card, cardIndex) => (
                          <div
                            key={`${card.label}-${cardIndex}`}
                            className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2"
                          >
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {card.label}
                            </div>
                            <div className="text-sm font-semibold text-foreground">
                              {card.value}
                            </div>
                            {card.description ? (
                              <div className="text-[11px] text-muted-foreground">
                                {card.description}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
              {isSending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Generating reply
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your question here."
                className="min-h-24 resize-none rounded-2xl border-border/80 bg-background"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Advisory assistant. Review before acting.
                </p>
                <Button
                  type="button"
                  className="gap-2 rounded-full px-4"
                  onClick={() => void submitMessage(input)}
                  disabled={isSending || !input.trim()}
                >
                  <SendHorizonal className="size-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className={cn(
          'pointer-events-auto flex items-center gap-3 rounded-full border border-primary/20 bg-primary px-4 py-3 text-primary-foreground shadow-xl transition-all hover:scale-[1.02] hover:shadow-2xl',
          isOpen && 'bg-foreground text-background',
        )}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse AI assistant' : 'Open AI assistant'}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-white/15">
          {isOpen ? <ChevronDown className="size-5" /> : <MessageCircleMore className="size-5" />}
        </span>
        <span className="text-left">
          <span className="block text-sm font-semibold">AI Assistant</span>
          <span className="block text-[11px] opacity-85">{isOpen ? 'Hide chat' : 'Ask a quick question'}</span>
        </span>
      </button>
    </div>
  )
}
