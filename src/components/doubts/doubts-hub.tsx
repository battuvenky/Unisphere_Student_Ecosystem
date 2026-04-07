"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Plus, Search, Sparkles, ThumbsDown, ThumbsUp, Lightbulb } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { AIDoubtAssistant } from "@/components/doubts/ai-doubt-assistant";
import { getRealtimeSocket } from "@/lib/realtime-client";

type VoteValue = -1 | 0 | 1;

type FeedQuestion = {
  id: string;
  isPending?: boolean;
  title: string;
  body: string;
  subject: string;
  tags: string[];
  author: {
    id: string;
    name: string;
    role: "student" | "admin";
    profileImageUrl?: string;
  };
  createdAt: string;
  votes: {
    up: number;
    down: number;
    score: number;
  };
  userVote: VoteValue;
  answersCount: number;
  commentsCount: number;
  lastActivityAt: string;
  topAnswers: Array<{
    id: string;
    body: string;
    createdAt: string;
    votes: {
      up: number;
      down: number;
      score: number;
    };
    author: {
      id: string;
      name: string;
      role: "student" | "admin";
      profileImageUrl?: string;
    };
  }>;
};

type FeedResponse = {
  questions: FeedQuestion[];
  subjects: string[];
};

type Suggestion = {
  id: string;
  title: string;
  subject: string;
  tags: string[];
  score: number;
  answersCount: number;
  snippet: string;
  recommendedAnswer: string | null;
  relatedTopics: string[];
};

type AIChatPayload = {
  success: boolean;
  reply: string;
  suggestions: string[];
  relatedQuestions: Array<{ id: string; title: string; subject: string }>;
};

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, 6);

  if (!terms.length) {
    return text;
  }

  const pattern = new RegExp(`(${terms.map((term) => escapeRegExp(term)).join("|")})`, "gi");
  const segments = text.split(pattern);

  return segments.map((segment, index) => {
    const isMatch = terms.some((term) => segment.toLowerCase() === term);
    return isMatch ? (
      <mark key={`${segment}-${index}`} className="rounded bg-[var(--accent)]/20 px-0.5 text-[var(--text-primary)]">
        {segment}
      </mark>
    ) : (
      <span key={`${segment}-${index}`}>{segment}</span>
    );
  });
}

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function avatarTone(seed: string) {
  const tones = [
    "bg-sky-500/20 text-sky-700 dark:text-sky-200",
    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200",
    "bg-amber-500/20 text-amber-700 dark:text-amber-200",
    "bg-violet-500/20 text-violet-700 dark:text-violet-200",
    "bg-rose-500/20 text-rose-700 dark:text-rose-200",
  ];

  let hash = 0;
  for (const char of seed) {
    hash += char.charCodeAt(0);
  }

  return tones[Math.abs(hash) % tones.length];
}

function AuthorAvatar({
  name,
  id,
  profileImageUrl,
  size = "h-7 w-7",
}: {
  name: string;
  id: string;
  profileImageUrl?: string;
  size?: string;
}) {
  if (profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profileImageUrl}
        alt={name}
        className={`${size} rounded-full border border-[var(--border)] object-cover`}
      />
    );
  }

  return (
    <span className={`inline-flex ${size} items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-semibold ${avatarTone(id)}`}>
      {initialsFromName(name)}
    </span>
  );
}

const sortOptions: Array<{ label: string; value: "new" | "top" | "unanswered" }> = [
  { label: "Newest", value: "new" },
  { label: "Top", value: "top" },
  { label: "Unanswered", value: "unanswered" },
];

function DoubtsFeedSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <article key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="flex gap-4">
            <div className="skeleton h-24 w-14 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="skeleton h-6 w-24 rounded-full" />
                <span className="skeleton h-6 w-20 rounded-full" />
                <span className="skeleton h-6 w-16 rounded-full" />
              </div>
              <div className="skeleton h-7 w-11/12 rounded-xl" />
              <div className="skeleton h-4 w-full rounded-lg" />
              <div className="skeleton h-4 w-5/6 rounded-lg" />
              <div className="flex gap-2 pt-1">
                <span className="skeleton h-4 w-24 rounded-lg" />
                <span className="skeleton h-4 w-32 rounded-lg" />
                <span className="skeleton h-4 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function DoubtsHub() {
  const [questions, setQuestions] = useState<FeedQuestion[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [sort, setSort] = useState<"new" | "top" | "unanswered">("new");
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formTags, setFormTags] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [recentlyPostedId, setRecentlyPostedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [aiDraftAnswer, setAiDraftAnswer] = useState<string>("");
  const [aiDraftHints, setAiDraftHints] = useState<string[]>([]);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set("query", search.trim());
    }
    if (subject !== "all") {
      params.set("subject", subject);
    }
    params.set("sort", sort);
    return params.toString();
  }, [search, subject, sort]);

  useEffect(() => {
    let cancelled = false;

    async function loadFeed() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/doubts?${queryString}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load doubts feed");
        }

        const data = (await response.json()) as FeedResponse;

        if (!cancelled) {
          setQuestions(data.questions);
          setSubjects(data.subjects);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load doubts");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFeed();

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  useEffect(() => {
    if (!recentlyPostedId) {
      return;
    }

    const timeoutId = setTimeout(() => setRecentlyPostedId(null), 1800);
    return () => clearTimeout(timeoutId);
  }, [recentlyPostedId]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) {
      return;
    }

    const handleRealtimeRefresh = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await fetch(`/api/doubts?${queryString}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as FeedResponse;
        setQuestions(data.questions);
        setSubjects(data.subjects);
      } catch {
        // Keep existing feed state if sync fails.
      }
    };

    socket.on("doubts:changed", handleRealtimeRefresh);
    socket.on("connect", handleRealtimeRefresh);

    return () => {
      socket.off("doubts:changed", handleRealtimeRefresh);
      socket.off("connect", handleRealtimeRefresh);
    };
  }, [queryString]);

  useEffect(() => {
    if (!isCreateOpen) {
      setSuggestions([]);
      setAiDraftAnswer("");
      setAiDraftHints([]);
      return;
    }

    const query = formTitle.trim();
    const detail = formBody.trim();

    if (query.length < 6 && detail.length < 10) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setSuggestionsLoading(true);

      try {
        const params = new URLSearchParams();
        if (query) {
          params.set("query", query);
        }
        if (detail) {
          params.set("body", detail);
        }

        const response = await fetch(`/api/doubts/suggestions?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load suggestions");
        }

        const payload = (await response.json()) as { suggestions: Suggestion[] };
        if (!cancelled) {
          setSuggestions(payload.suggestions ?? []);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isCreateOpen, formTitle, formBody]);

  useEffect(() => {
    if (!isCreateOpen) {
      return;
    }

    const query = formTitle.trim();
    const detail = formBody.trim();

    if (query.length < 8 && detail.length < 20) {
      setAiDraftAnswer("");
      setAiDraftHints([]);
      setAiDraftLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setAiDraftLoading(true);

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Suggest a concise answer and improvements for this doubt draft.",
            draftTitle: query,
            draftBody: detail,
            mode: "draft-help",
          }),
        });

        const payload = (await response.json()) as AIChatPayload | { error?: string };
        if (!response.ok || !(payload as AIChatPayload).success) {
          throw new Error((payload as { error?: string }).error ?? "Could not get AI suggestion");
        }

        if (!cancelled) {
          const okPayload = payload as AIChatPayload;
          setAiDraftAnswer(okPayload.reply);
          setAiDraftHints(okPayload.suggestions ?? []);
        }
      } catch {
        if (!cancelled) {
          setAiDraftAnswer("");
          setAiDraftHints([]);
        }
      } finally {
        if (!cancelled) {
          setAiDraftLoading(false);
        }
      }
    }, 360);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isCreateOpen, formTitle, formBody]);

  const handleCreateQuestion = async (event: React.FormEvent) => {
    event.preventDefault();

    if (submitState === "saving") {
      return;
    }

    setError(null);
    setSubmitState("saving");

    const tempId = `pending-${Date.now()}`;
    const optimisticQuestion: FeedQuestion = {
      id: tempId,
      isPending: true,
      title: formTitle.trim(),
      body: formBody.trim(),
      subject: formSubject.trim() || "General",
      tags: formTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 5),
      author: {
        id: "you",
        name: "You",
        role: "student",
      },
      createdAt: new Date().toISOString(),
      votes: {
        up: 0,
        down: 0,
        score: 0,
      },
      userVote: 0,
      answersCount: 0,
      commentsCount: 0,
      lastActivityAt: new Date().toISOString(),
        topAnswers: [],
    };

    setSearch("");
    setSubject("all");
    setSort("new");
    setQuestions((prev) => [optimisticQuestion, ...prev]);

    try {
      const tags = formTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const response = await fetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          body: formBody,
          subject: formSubject,
          tags,
        }),
      });

      const payload = (await response.json()) as { error?: string; question?: FeedQuestion };

      if (!response.ok || !payload.question) {
        throw new Error(payload.error ?? "Could not post question");
      }

      const createdQuestion: FeedQuestion = payload.question;

      const createdWithMeta = {
        ...createdQuestion,
        answersCount: 0,
        commentsCount: 0,
        lastActivityAt: createdQuestion.createdAt,
      };

      // Ensure newly posted doubts are visible immediately even if strict filters were active.
      setQuestions((prev) => [createdWithMeta, ...prev.filter((item) => item.id !== tempId && item.id !== createdWithMeta.id)]);
      setRecentlyPostedId(createdWithMeta.id);

      setIsCreateOpen(false);
      setFormTitle("");
      setFormBody("");
      setFormSubject("");
      setFormTags("");
      setSuggestions([]);

      if (!subjects.includes(createdQuestion.subject)) {
        setSubjects((prev) => [...prev, createdQuestion.subject].sort((a, b) => a.localeCompare(b)));
      }
    } catch (submitError) {
      setQuestions((prev) => prev.filter((item) => item.id !== tempId));
      setError(submitError instanceof Error ? submitError.message : "Could not post question");
    } finally {
      setSubmitState("idle");
    }
  };

  const castVote = async (questionId: string, action: "up" | "down") => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const priorVote = question.userVote;
        const nextVote = action === "up" ? (priorVote === 1 ? 0 : 1) : priorVote === -1 ? 0 : -1;
        const up = question.votes.up - (priorVote === 1 ? 1 : 0) + (nextVote === 1 ? 1 : 0);
        const down = question.votes.down - (priorVote === -1 ? 1 : 0) + (nextVote === -1 ? 1 : 0);

        return {
          ...question,
          userVote: nextVote,
          votes: {
            up,
            down,
            score: up - down,
          },
        };
      })
    );

    try {
      const response = await fetch(`/api/doubts/${questionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: action }),
      });

      if (!response.ok) {
        throw new Error("Vote request failed");
      }

      const payload = (await response.json()) as {
        votes: { up: number; down: number; score: number };
        userVote: VoteValue;
      };

      setQuestions((prev) =>
        prev.map((question) =>
          question.id === questionId
            ? {
                ...question,
                votes: payload.votes,
                userVote: payload.userVote,
              }
            : question
        )
      );
    } catch {
      // Reloading feed keeps client and server vote state in sync after a failed optimistic update.
      const response = await fetch(`/api/doubts?${queryString}`, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as FeedResponse;
        setQuestions(data.questions);
      }
    }
  };

  return (
    <section className="page-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            <Sparkles size={14} />
            UniSphere Doubt Forum
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Discuss and Solve Together</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Post academic doubts, help peers with detailed answers, and build threaded conversations around every concept.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
        >
          <Plus size={16} />
          Ask Question
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Search</p>
            <label className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search doubts"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--accent)]"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Sort</p>
            <div className="space-y-2">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                    sort === option.value
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Subject</p>
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="all">All subjects</option>
              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
          ) : null}

          {loading ? <DoubtsFeedSkeleton /> : null}

          {!loading && questions.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="No discussions yet 💭"
              message="Be the first to ask a question or help someone by answering in this subject area."
              actionLabel="Create Question"
              onAction={() => setIsCreateOpen(true)}
            />
          ) : null}

          {!loading
            ? questions.map((question) => (
                <article
                  key={question.id}
                  className={`card-hover rounded-2xl border bg-[var(--card)] p-5 shadow-sm transition-all duration-300 ${
                    question.id === recentlyPostedId
                      ? "message-bubble-enter border-[var(--accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="flex w-14 flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-2">
                      <button
                        type="button"
                        onClick={() => void castVote(question.id, "up")}
                        disabled={question.isPending}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 ${
                          question.userVote === 1 ? "bg-emerald-500/20 text-emerald-300" : "text-[var(--text-secondary)]"
                        }`}
                        aria-label="Upvote question"
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <span className="text-sm font-bold text-[var(--text-primary)]">{question.votes.score}</span>
                      <button
                        type="button"
                        onClick={() => void castVote(question.id, "down")}
                        disabled={question.isPending}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 ${
                          question.userVote === -1 ? "bg-red-500/20 text-red-300" : "text-[var(--text-secondary)]"
                        }`}
                        aria-label="Downvote question"
                      >
                        <ThumbsDown size={14} />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 font-medium text-[var(--text-primary)]">
                          {question.subject}
                        </span>
                        {question.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-2.5 py-1 text-[var(--text-secondary)]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <Link href={`/doubts/${question.id}`} className={`block group/title ${question.isPending ? "pointer-events-none opacity-85" : ""}`} prefetch>
                        <h2 className="text-xl font-semibold leading-tight text-[var(--text-primary)] transition-colors group-hover/title:text-[var(--accent)]">
                          {question.title}
                        </h2>
                        <p className="mt-2 line-clamp-2 text-sm text-[var(--text-secondary)]">{question.body}</p>
                      </Link>

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                        {question.isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-2 py-0.5 text-[var(--text-primary)]">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                            Posting...
                          </span>
                        ) : null}
                        <AuthorAvatar name={question.author.name} id={question.author.id} profileImageUrl={question.author.profileImageUrl} />
                        <span className="font-medium text-[var(--text-primary)]">{question.author.name}</span>
                        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-0.5 capitalize">
                          {question.author.role}
                        </span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(question.createdAt), { addSuffix: true })}</span>
                        <span>•</span>
                        <span>{new Date(question.createdAt).toLocaleString()}</span>
                        <span>•</span>
                        <span>{question.answersCount} answers</span>
                        <span>•</span>
                        <span>{question.commentsCount} comments</span>
                      </div>

                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                        <MessageSquare size={13} />
                        Last activity {formatDistanceToNow(new Date(question.lastActivityAt), { addSuffix: true })}
                      </div>

                      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                            Answers ({question.answersCount})
                          </p>
                          <Link href={`/doubts/${question.id}`} className="text-xs font-medium text-[var(--accent)]">
                            View thread
                          </Link>
                        </div>

                        {question.topAnswers.length === 0 ? (
                          <p className="text-xs text-[var(--text-secondary)]">No answers yet. Be the first to respond.</p>
                        ) : (
                          <div className="space-y-2">
                            {question.topAnswers.map((answer, index) => (
                              <div key={answer.id} className={`rounded-lg border bg-[var(--card)] p-2.5 ${index === 0 ? "border-emerald-400/40" : "border-[var(--border)]"}`}>
                                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                  <AuthorAvatar
                                    name={answer.author.name}
                                    id={answer.author.id}
                                    profileImageUrl={answer.author.profileImageUrl}
                                    size="h-6 w-6"
                                  />
                                  <span className="font-medium text-[var(--text-primary)]">{answer.author.name}</span>
                                  {index === 0 ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Top answer</span> : null}
                                  <span>•</span>
                                  <span>score {answer.votes.score}</span>
                                </div>
                                <p className="mt-1.5 line-clamp-2 text-xs text-[var(--text-secondary)]">{answer.body}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            : null}
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="auth-glass-card fade-slide-enter w-full max-w-2xl rounded-3xl border border-[var(--border)] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">Ask a new question</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Write clear context so peers can answer quickly.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--text-secondary)]"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-3">
              <input
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                className="auth-input"
                placeholder="Question title"
                required
                minLength={10}
              />

              {(suggestionsLoading || suggestions.length > 0) && formTitle.trim().length >= 6 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/70 p-3 transition-all duration-300 ease-in-out">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                      Similar doubts and suggested answers
                    </p>
                    {suggestionsLoading ? <span className="text-xs text-[var(--text-secondary)]">Finding matches...</span> : null}
                  </div>

                  <div className="space-y-2">
                    {suggestions.map((item) => (
                      <Link
                        key={item.id}
                        href={`/doubts/${item.id}`}
                        className="group block rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)]/50"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[var(--text-primary)]">{item.subject}</span>
                          <span className="text-[var(--text-secondary)]">{item.answersCount} answers</span>
                          <span className="text-[var(--text-secondary)]">match {Math.round(item.score * 10)}%</span>
                        </div>

                        <h3 className="text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                          {highlightMatch(item.title, `${formTitle} ${formBody}`)}
                        </h3>

                        <p className="mt-1 text-xs text-[var(--text-secondary)]">{highlightMatch(item.snippet, `${formTitle} ${formBody}`)}</p>

                        {item.recommendedAnswer ? (
                          <p className="mt-2 text-xs text-[var(--text-secondary)]">
                            <span className="font-medium text-[var(--text-primary)]">Suggested answer: </span>
                            {highlightMatch(item.recommendedAnswer, `${formTitle} ${formBody}`)}
                          </p>
                        ) : null}

                        {item.relatedTopics.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.relatedTopics.map((topic) => (
                              <span
                                key={topic}
                                className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </Link>
                    ))}

                    {!suggestionsLoading && suggestions.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        No close matches yet. You can post this as a new question.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {(aiDraftLoading || aiDraftAnswer || aiDraftHints.length > 0) && formTitle.trim().length >= 6 ? (
                <div className="fade-slide-enter rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/70 p-3 transition-all duration-300 ease-in-out">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                      AI answer suggestion
                    </p>
                    {aiDraftLoading ? <span className="text-xs text-[var(--text-secondary)]">AI is thinking...</span> : null}
                  </div>

                  {aiDraftAnswer ? (
                    <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      {highlightMatch(aiDraftAnswer, `${formTitle} ${formBody}`)}
                    </p>
                  ) : null}

                  {aiDraftHints.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {aiDraftHints.map((hint) => (
                        <li key={hint} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                          {highlightMatch(hint, `${formTitle} ${formBody}`)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <textarea
                value={formBody}
                onChange={(event) => setFormBody(event.target.value)}
                className="auth-input min-h-36 resize-y"
                placeholder="Describe your doubt and what you already tried"
                required
                minLength={20}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={formSubject}
                  onChange={(event) => setFormSubject(event.target.value)}
                  className="auth-input"
                  placeholder="Subject (e.g. Data Structures)"
                  required
                  minLength={2}
                />
                <input
                  value={formTags}
                  onChange={(event) => setFormTags(event.target.value)}
                  className="auth-input"
                  placeholder="Tags (comma separated)"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitState === "saving"}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-70"
                >
                  {submitState === "saving" ? "Posting..." : "Post Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <AIDoubtAssistant draftTitle={formTitle} draftBody={formBody} />
    </section>
  );
}
