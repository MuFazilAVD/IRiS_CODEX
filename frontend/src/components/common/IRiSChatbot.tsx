import { useMemo, useRef, useState } from 'react'
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

const OPENING_MESSAGE =
  "Hi, I'm IRiS Assist. I can answer questions about what's on screen, navigate you to any module you're permitted to access, and pull up specific contracts, settlements, files or screening hits. Try 'show me contract LSC-2024-019' or 'what's the Q1 settlement variance?'"

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
        <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[380px] flex-col border-l border-[#D8E2EA] bg-white shadow-[0_20px_60px_rgba(13,27,42,0.18)]">
          <div className="flex items-start justify-between gap-4 bg-iris-navy px-4 py-3 text-white">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-md bg-white/95">
                <MessageSquarePlus className="h-4 w-4 text-iris-navy" />
              </div>
              <div>
                <p className="text-[13px] font-semibold leading-5">IRiS Assist</p>
                <p className="text-[12px] text-white/75">
                  {roleLabel} · {location.pathname}
                </p>
              </div>
            </div>
            <button className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => setChatbotOpen(false)} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="rounded-2xl bg-[#F1F4F7] px-4 py-3 text-[13px] leading-7 text-iris-text-primary">
              <strong>Hi, I&apos;m IRiS Assist.</strong> I can answer questions about what&apos;s on screen, navigate you to any module you&apos;re permitted to access, and pull up specific contracts, settlements, files or screening hits. Try{' '}
              <em>&quot;show me contract LSC-2024-019&quot;</em> or <em>&quot;what&apos;s the Q1 settlement variance?&quot;</em>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[12px] text-iris-text-secondary">Quick actions for {roleLabel}</p>
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
                    className={`max-w-[86%] rounded-2xl px-4 py-3 text-[13px] leading-6 shadow-sm ${
                      message.role === 'user' ? 'bg-iris-navy text-white' : 'bg-[#F1F4F7] text-iris-text-primary'
                    }`}
                  >
                    <p>{message.content}</p>
                    {message.navigationAction ? (
                      <button
                        className="mt-3 rounded-full border border-[#AED6F1] bg-[#EBF5FB] px-3 py-1.5 text-[12px] font-semibold text-iris-blue"
                        onClick={() => {
                          navigate(message.navigationAction as string)
                          setChatbotOpen(false)
                        }}
                        type="button"
                      >
                        Go to →
                      </button>
                    ) : null}
                    {message.sources?.length ? (
                      <p className="mt-2 text-[11px] text-iris-text-secondary">Sources: {message.sources.join(' · ')}</p>
                    ) : null}
                  </div>
                </div>
              ))}

              {submitting ? (
                <div className="flex justify-start">
                  <div className="max-w-[86%] rounded-2xl bg-[#F1F4F7] px-4 py-3 text-[13px] text-iris-text-secondary shadow-sm">
                    IRiS is thinking...
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
                placeholder="Ask about anything on screen..."
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
  if (role === 'compliance') {
    return [
      'Show me the latest screening hits',
      'Open the compliance dashboard',
      'Any FYA items on my worklist?',
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
      'Any FYA items on my worklist?',
    ]
  }
  return [
    'Open the operations dashboard',
    'Any FYA items on my worklist?',
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
