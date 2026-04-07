"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AssistantResponse = {
  success: boolean;
  reply: string;
  suggestions: string[];
  relatedQuestions: Array<{
    id: string;
    title: string;
    subject: string;
  }>;
  error?: string;
};

type AIDoubtAssistantProps = {
  questionId?: string;
  draftTitle?: string;
  draftBody?: string;
  className?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AIDoubtAssistant({ questionId, draftTitle, draftBody, className = "" }: AIDoubtAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Hi! I am your UniSphere AI doubt assistant. Ask me anything, or I can help refine your doubt before posting.",
    },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [relatedQuestions, setRelatedQuestions] = useState<AssistantResponse["relatedQuestions"]>([]);

  const panelRef = useRef<HTMLDivElement | null>(null);

  const hasDraft = useMemo(
    () => Boolean((draftTitle ?? "").trim() || (draftBody ?? "").trim()),
    [draftTitle, draftBody]
  );

  const askAssistant = async (message: string, opts?: { fromDraft?: boolean }) => {
    const trimmed = message.trim();
    if (!trimmed || sending) {
      return;
    }

    const userMessage: AssistantMessage = { id: uid(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          draftTitle: opts?.fromDraft ? draftTitle : undefined,
          draftBody: opts?.fromDraft ? draftBody : undefined,
          questionId,
          mode: questionId ? "thread-answer" : opts?.fromDraft ? "draft-help" : "chat",
        }),
      });

      const payload = (await response.json()) as AssistantResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Could not get AI response");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: payload.reply,
        },
      ]);
      setSuggestions(payload.suggestions ?? []);
      setRelatedQuestions(payload.relatedQuestions ?? []);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Could not get AI help right now.",
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => {
        panelRef.current?.scrollTo({ top: panelRef.current.scrollHeight, behavior: "smooth" });
      }, 16);
    }
  };

  return (
    <div className={`fixed bottom-5 right-5 z-40 ${className}`}>
      {isOpen ? (
        <div className="w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_50px_rgba(2,8,20,0.22)] fade-slide-enter">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <Bot size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">AI Doubt Assistant</p>
                <p className="text-[11px] text-[var(--text-secondary)]">Instant explanation and guidance</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
              aria-label="Close AI assistant"
            >
              <X size={14} />
            </button>
          </div>

          <div ref={panelRef} className="max-h-[52vh] space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm message-bubble-enter ${
                    message.role === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-primary)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}

            {sending ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--accent)]">
                  <span className="typing-dot" />
                  <span className="typing-dot [animation-delay:120ms]" />
                  <span className="typing-dot [animation-delay:240ms]" />
                  AI typing...
                </div>
              </div>
            ) : null}

            {relatedQuestions.length > 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Related threads</p>
                <div className="space-y-1">
                  {relatedQuestions.map((item) => (
                    <Link
                      key={item.id}
                      href={`/doubts/${item.id}`}
                      className="block rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--accent)]/55"
                    >
                      <p className="line-clamp-1 font-medium">{item.title}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{item.subject}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Quick suggestions</p>
                <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                  {suggestions.map((item) => (
                    <li key={item} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-3 py-3">
            {hasDraft ? (
              <button
                type="button"
                disabled={sending}
                onClick={() =>
                  void askAssistant(
                    "Please review my current doubt draft and suggest improvements before posting.",
                    { fromDraft: true }
                  )
                }
                className="mb-2 inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]"
              >
                <Sparkles size={13} />
                Analyze current draft
              </button>
            ) : null}

            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                placeholder={questionId ? "Ask for a suggested answer..." : "Ask your doubt to AI..."}
              />
              <button
                type="button"
                onClick={() => void askAssistant(input)}
                disabled={sending || !input.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-white disabled:opacity-60"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="mt-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_12px_30px_rgba(47,111,237,0.45)] transition-all duration-200 hover:scale-105"
        aria-label="Open AI doubt assistant"
      >
        <Bot size={22} />
      </button>
    </div>
  );
}
