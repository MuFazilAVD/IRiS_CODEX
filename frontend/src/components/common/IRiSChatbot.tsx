import { Fragment, type ReactNode, useMemo, useRef, useState } from 'react'
import { MessageSquarePlus, Send, Sparkles, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { api } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { useUiStore } from '../../store/uiStore'
import type { ChatbotConversationEntry, ChatbotResponsePayload } from '../../types/api'

type ConversationMessage = ChatbotConversationEntry & {
  id: string
  navigationAction?: string | null
  sources?: string[]
}

const OPENING_MESSAGE = `**IRiS Assist**

I can help with:
- current-page context
- live data questions
- permitted navigation

Try \`show me contract LSC-2024-019\` or \`what is the Q1 settlement variance?\``

export function IRiSChatbot() {
  const navigate = useNavigate()
  const location = useLocation()
  const { effectiveRole } = useAuth()
  const { chatbotOpen, setChatbotOpen, toggleChatbot } = useUiStore()
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: 'opening-assistant',
      role: 'assistant',
      content: OPENING_MESSAGE,
    },
  ])
  const endRef = useRef<HTMLDivElement | null>(null)

  const roleKey = effectiveRole ?? 'admin'
  const roleLabel = roleDisplayLabel(roleKey)
  const locationLabel = formatLocationChip(location.pathname)
  const quickActions = useMemo(() => quickActionsForRole(roleKey), [roleKey])

  async function submitMessage(message: string) {
    const trimmed = message.trim()
    if (!trimmed || submitting || !effectiveRole) {
      return
    }

    const nextUserMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    const nextConversationHistory = [
      ...messages.map((item) => ({ role: item.role, content: item.content })),
      { role: nextUserMessage.role, content: nextUserMessage.content },
    ]

    setMessages((current) => [...current, nextUserMessage])
    setInputValue('')
    setSubmitting(true)

    try {
      const { data } = await api.post<ChatbotResponsePayload>('/chatbot/message', {
        message: trimmed,
        conversation_history: nextConversationHistory,
        user_role: effectiveRole,
        current_page: location.pathname,
      })
      const navigationAction = data.navigation_action ?? extractNavigationTag(data.response)
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: stripNavigationTag(data.response),
          navigationAction,
          sources: data.sources,
        },
      ])
      queueMicrotask(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
    } catch (caughtError: unknown) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: extractErrorMessage(caughtError) ?? 'I could not process that request right now.',
        },
      ])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-40 grid h-[52px] w-[52px] place-items-center rounded-full bg-iris-navy shadow-[0_16px_32px_rgba(13,27,42,0.28)] transition hover:translate-y-[-1px]"
        onClick={toggleChatbot}
        type="button"
      >
        <Sparkles className="h-5 w-5 text-iris-teal" />
      </button>

      {chatbotOpen ? (
        <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[420px] flex-col border-l border-[#D8E2EA] bg-white shadow-[0_20px_60px_rgba(13,27,42,0.18)]">
          <div className="flex items-start justify-between gap-4 bg-iris-navy px-4 py-3 text-white">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-md bg-white/95">
                <MessageSquarePlus className="h-4 w-4 text-iris-navy" />
              </div>
              <div>
                <p className="text-[13px] font-semibold leading-5">IRiS Assist</p>
                <p className="text-[12px] text-white/75">
                  {roleLabel} - {locationLabel}
                </p>
              </div>
            </div>
            <button className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => setChatbotOpen(false)} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="rounded-2xl bg-[#F1F4F7] px-4 py-3 text-[13px] leading-7 text-iris-text-primary">
              <MarkdownMessage content={OPENING_MESSAGE} />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[12px] text-iris-text-secondary">Suggested queries</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((item) => (
                  <button
                    key={item}
                    className="rounded-full border border-iris-border bg-white px-3 py-2 text-left text-[13px] text-iris-text-primary shadow-sm transition hover:bg-[#F7FAFC]"
                    onClick={() => void submitMessage(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {messages.slice(1).map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-6 shadow-sm ${
                      message.role === 'user' ? 'bg-iris-navy text-white' : 'bg-[#F1F4F7] text-iris-text-primary'
                    }`}
                  >
                    <MarkdownMessage content={message.content} />
                    {message.navigationAction ? (
                      <button
                        className="mt-3 rounded-full border border-[#AED6F1] bg-[#EBF5FB] px-3 py-1.5 text-[12px] font-semibold text-iris-blue"
                        onClick={() => {
                          navigate(message.navigationAction as string)
                          setChatbotOpen(false)
                        }}
                        type="button"
                      >
                        Go to {'->'}
                      </button>
                    ) : null}
                    {message.sources?.length ? (
                      <p className="mt-2 text-[11px] text-iris-text-secondary">Sources: {message.sources.join(' - ')}</p>
                    ) : null}
                  </div>
                </div>
              ))}

              {submitting ? (
                <div className="flex justify-start">
                  <div className="max-w-[86%] rounded-2xl bg-[#F1F4F7] px-4 py-3 text-[13px] text-iris-text-secondary shadow-sm">
                    IRiS is analyzing the request...
                  </div>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </div>

          <div className="border-t border-iris-border bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                className="field-input flex-1"
                placeholder="Ask a business or navigation question..."
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submitMessage(inputValue)
                  }
                }}
              />
              <button
                className="grid h-10 w-10 place-items-center rounded-md bg-[#8A96A3] text-white transition hover:bg-iris-blue disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || !inputValue.trim()}
                onClick={() => void submitMessage(inputValue)}
                type="button"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </>
  )
}

function quickActionsForRole(role: string) {
  if (role === 'admin') {
    return [
      'Open the admin dashboard',
      'Show recent audit trail entries',
    ]
  }
  if (role === 'compliance') {
    return [
      'Show me the latest screening hits',
      'Open the compliance dashboard',
      'Show recent audit trail entries',
    ]
  }
  if (role === 'claims_ops') {
    return [
      'Show me the latest cession files',
      'Open the settlements workbench',
      'Any pending approvals on my worklist?',
      "What's the Q1 settlement variance?",
    ]
  }
  if (role === 'underwriter') {
    return [
      'Show me contract LSC-2024-019',
      'Open the underwriting dashboard',
      'How many active contracts do we have with Northstar?',
    ]
  }
  return [
    'Open the admin dashboard',
    'Show recent audit trail entries',
  ]
}

function roleDisplayLabel(role: string) {
  return {
    admin: 'Admin',
    underwriter: 'Underwriting',
    claims_ops: 'Claims Ops',
    compliance: 'Compliance',
  }[role] ?? role.replace('_', ' ')
}

function stripNavigationTag(content: string) {
  return content.replace(/\[NAV:\s*[^\]]+\]/g, '').trim()
}

function extractNavigationTag(content: string) {
  const match = content.match(/\[NAV:\s*([^\]]+)\]/)
  return match ? match[1].trim() : null
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string } } }
  return maybeMessage.response?.data?.details
}

function formatLocationChip(pathname: string) {
  if (pathname === '/dashboard') {
    return '/'
  }
  return pathname
}

function MarkdownMessage({ content }: { content: string }) {
  return <div className="iris-chat-markdown">{renderMarkdownBlocks(content)}</div>
}

function renderMarkdownBlocks(content: string) {
  const blocks = splitMarkdownBlocks(content)

  return blocks.map((block, index) => {
    const key = `block-${index}`

    if (isMarkdownTable(block)) {
      const rows = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      const header = splitTableRow(rows[0])
      const bodyRows = rows.slice(2).map(splitTableRow)

      return (
        <div className="iris-chat-table-wrap" key={key}>
          <table>
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={`${key}-h-${cellIndex}`}>{renderInlineMarkdown(cell, `${key}-h-${cellIndex}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr key={`${key}-r-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${key}-r-${rowIndex}-${cellIndex}`}>{renderInlineMarkdown(cell, `${key}-r-${rowIndex}-${cellIndex}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (isListBlock(block, /^[-*]\s+/)) {
      return (
        <ul key={key}>
          {block.split('\n').map((line, lineIndex) => (
            <li key={`${key}-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ''), `${key}-${lineIndex}`)}</li>
          ))}
        </ul>
      )
    }

    if (isListBlock(block, /^\d+\.\s+/)) {
      return (
        <ol key={key}>
          {block.split('\n').map((line, lineIndex) => (
            <li key={`${key}-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''), `${key}-${lineIndex}`)}</li>
          ))}
        </ol>
      )
    }

    return (
      <p key={key}>
        {block.split('\n').map((line, lineIndex) => (
          <Fragment key={`${key}-${lineIndex}`}>
            {lineIndex > 0 ? <br /> : null}
            {renderInlineMarkdown(line, `${key}-${lineIndex}`)}
          </Fragment>
        ))}
      </p>
    )
  })
}

function splitMarkdownBlocks(content: string) {
  return content
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function isListBlock(block: string, markerPattern: RegExp) {
  return block
    .split('\n')
    .map((line) => line.trim())
    .every((line) => markerPattern.test(line))
}

function isMarkdownTable(block: string) {
  const rows = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return rows.length >= 2 && rows[0].includes('|') && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(rows[1])
}

function splitTableRow(row: string) {
  return row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const tokens: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      tokens.push(text.slice(cursor, match.index))
    }

    const value = match[0]
    const key = `${keyPrefix}-inline-${match.index}`

    if (value.startsWith('**') || value.startsWith('__')) {
      tokens.push(<strong key={key}>{value.slice(2, -2)}</strong>)
    } else if (value.startsWith('*') || value.startsWith('_')) {
      tokens.push(<em key={key}>{value.slice(1, -1)}</em>)
    } else if (value.startsWith('`')) {
      tokens.push(<code key={key}>{value.slice(1, -1)}</code>)
    } else {
      const linkMatch = value.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
      if (linkMatch) {
        tokens.push(
          <a href={linkMatch[2]} key={key} rel="noreferrer" target="_blank">
            {linkMatch[1]}
          </a>,
        )
      } else {
        tokens.push(value)
      }
    }

    cursor = match.index + value.length
  }

  if (cursor < text.length) {
    tokens.push(text.slice(cursor))
  }

  return tokens
}
