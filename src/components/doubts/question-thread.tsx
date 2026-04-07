"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, CornerDownRight, MessageCircle, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { AIDoubtAssistant } from "@/components/doubts/ai-doubt-assistant";
import { getRealtimeSocket } from "@/lib/realtime-client";

type VoteValue = -1 | 0 | 1;

type Author = {
  id: string;
  name: string;
  role: "student" | "admin";
  profileImageUrl?: string;
};

type Question = {
  id: string;
  title: string;
  body: string;
  subject: string;
  tags: string[];
  author: Author;
  createdAt: string;
  votes: { up: number; down: number; score: number };
  userVote: VoteValue;
};

type Answer = {
  id: string;
  isPending?: boolean;
  questionId: string;
  body: string;
  author: Author;
  createdAt: string;
  votes: { up: number; down: number; score: number };
  userVote: VoteValue;
};

type Comment = {
  id: string;
  questionId: string;
  answerId: string | null;
  parentId: string | null;
  body: string;
  author: Author;
  createdAt: string;
};

type ThreadPayload = {
  question: Question;
  answers: Answer[];
  comments: Comment[];
};

type QuestionThreadProps = {
  questionId: string;
};

type CommentFormState = {
  target: "question" | "answer";
  answerId?: string;
  parentId?: string;
};

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
  author,
  size = "h-7 w-7",
}: {
  author: Author;
  size?: string;
}) {
  if (author.profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.profileImageUrl}
        alt={author.name}
        className={`${size} rounded-full border border-[var(--border)] object-cover`}
      />
    );
  }

  return (
    <span className={`inline-flex ${size} items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-semibold ${avatarTone(author.id)}`}>
      {initialsFromName(author.name)}
    </span>
  );
}

function buildCommentTree(comments: Comment[]) {
  const byParent = new Map<string, Comment[]>();

  for (const comment of comments) {
    const key = comment.parentId ?? "root";
    const existing = byParent.get(key) ?? [];
    existing.push(comment);
    byParent.set(key, existing);
  }

  const getChildren = (parentId: string | null) => {
    const key = parentId ?? "root";
    return byParent.get(key) ?? [];
  };

  return { getChildren };
}

export function QuestionThread({ questionId }: QuestionThreadProps) {
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentFormState, setCommentFormState] = useState<CommentFormState | null>(null);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [newAnswerIds, setNewAnswerIds] = useState<string[]>([]);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/doubts/${questionId}`, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(response.status === 404 ? "Question not found" : "Could not load discussion");
      }

      const payload = (await response.json()) as ThreadPayload;
      setThread(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load discussion");
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) {
      return;
    }

    const handleRealtimeRefresh = async (payload?: { questionId?: string }) => {
      if (payload?.questionId && payload.questionId !== questionId) {
        return;
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await fetch(`/api/doubts/${questionId}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const nextPayload = (await response.json()) as ThreadPayload;
        setThread(nextPayload);
      } catch {
        // Keep the current thread visible on sync failures.
      }
    };

    socket.on("doubts:changed", handleRealtimeRefresh);
    socket.on("connect", handleRealtimeRefresh);

    return () => {
      socket.off("doubts:changed", handleRealtimeRefresh);
      socket.off("connect", handleRealtimeRefresh);
    };
  }, [questionId]);

  const questionComments = useMemo(() => thread?.comments.filter((item) => item.answerId === null) ?? [], [thread]);

  const answerCommentsById = useMemo(() => {
    const map = new Map<string, Comment[]>();

    for (const comment of thread?.comments ?? []) {
      if (!comment.answerId) {
        continue;
      }
      const list = map.get(comment.answerId) ?? [];
      list.push(comment);
      map.set(comment.answerId, list);
    }

    return map;
  }, [thread]);

  const topAnswerId = useMemo(() => {
    if (!thread || thread.answers.length === 0) {
      return null;
    }

    const sorted = [...thread.answers].sort(
      (a, b) => b.votes.score - a.votes.score || Date.parse(a.createdAt) - Date.parse(b.createdAt)
    );

    if ((sorted[0]?.votes.score ?? 0) <= 0) {
      return null;
    }

    return sorted[0]?.id ?? null;
  }, [thread]);

  const castQuestionVote = async (action: "up" | "down") => {
    if (!thread) {
      return;
    }

    setThread((prev) => {
      if (!prev) {
        return prev;
      }

      const current = prev.question.userVote;
      const nextVote = action === "up" ? (current === 1 ? 0 : 1) : current === -1 ? 0 : -1;
      const up = prev.question.votes.up - (current === 1 ? 1 : 0) + (nextVote === 1 ? 1 : 0);
      const down = prev.question.votes.down - (current === -1 ? 1 : 0) + (nextVote === -1 ? 1 : 0);

      return {
        ...prev,
        question: {
          ...prev.question,
          userVote: nextVote,
          votes: { up, down, score: up - down },
        },
      };
    });

    const response = await fetch(`/api/doubts/${questionId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote: action }),
    });

    if (!response.ok) {
      await loadThread();
      return;
    }

    const payload = (await response.json()) as {
      votes: { up: number; down: number; score: number };
      userVote: VoteValue;
    };

    setThread((prev) =>
      prev
        ? {
            ...prev,
            question: {
              ...prev.question,
              votes: payload.votes,
              userVote: payload.userVote,
            },
          }
        : prev
    );
  };

  const castAnswerVote = async (answerId: string, action: "up" | "down") => {
    if (!thread) {
      return;
    }

    setThread((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        answers: prev.answers.map((answer) => {
          if (answer.id !== answerId) {
            return answer;
          }

          const current = answer.userVote;
          const nextVote = action === "up" ? (current === 1 ? 0 : 1) : current === -1 ? 0 : -1;
          const up = answer.votes.up - (current === 1 ? 1 : 0) + (nextVote === 1 ? 1 : 0);
          const down = answer.votes.down - (current === -1 ? 1 : 0) + (nextVote === -1 ? 1 : 0);

          return {
            ...answer,
            userVote: nextVote,
            votes: { up, down, score: up - down },
          };
        }),
      };
    });

    const response = await fetch(`/api/doubts/${questionId}/answers/${answerId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote: action }),
    });

    if (!response.ok) {
      await loadThread();
      return;
    }

    const payload = (await response.json()) as {
      votes: { up: number; down: number; score: number };
      userVote: VoteValue;
    };

    setThread((prev) =>
      prev
        ? {
            ...prev,
            answers: prev.answers.map((answer) =>
              answer.id === answerId
                ? {
                    ...answer,
                    votes: payload.votes,
                    userVote: payload.userVote,
                  }
                : answer
            ),
          }
        : prev
    );
  };

  const submitAnswer = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!answerDraft.trim() || savingAnswer) {
      return;
    }

    setSavingAnswer(true);
    setError(null);

    const draftValue = answerDraft.trim();
    const optimisticId = `pending-answer-${Date.now()}`;
    const optimisticAnswer: Answer = {
      id: optimisticId,
      isPending: true,
      questionId,
      body: draftValue,
      author: {
        id: "you",
        name: "You",
        role: "student",
      },
      createdAt: new Date().toISOString(),
      votes: { up: 0, down: 0, score: 0 },
      userVote: 0,
    };

    setThread((prev) =>
      prev
        ? {
            ...prev,
            answers: [...prev.answers, optimisticAnswer],
          }
        : prev
    );
    setAnswerDraft("");

    try {
      const response = await fetch(`/api/doubts/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draftValue }),
      });

      const payload = (await response.json()) as { error?: string; answer?: Answer };

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error ?? "Could not submit answer");
      }

      const createdAnswer: Answer = payload.answer;

      setThread((prev) =>
        prev
          ? {
              ...prev,
              answers: prev.answers.map((answer) =>
                answer.id === optimisticId
                  ? createdAnswer
                  : answer
              ),
            }
          : prev
      );
      setNewAnswerIds((prev) => [...prev, createdAnswer.id]);
    } catch (submitError) {
      setThread((prev) =>
        prev
          ? {
              ...prev,
              answers: prev.answers.filter((answer) => answer.id !== optimisticId),
            }
          : prev
      );
      setAnswerDraft(draftValue);
      setError(submitError instanceof Error ? submitError.message : "Could not submit answer");
    } finally {
      setSavingAnswer(false);
    }
  };

  useEffect(() => {
    if (newAnswerIds.length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => setNewAnswerIds([]), 1800);
    return () => clearTimeout(timeoutId);
  }, [newAnswerIds]);

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!commentFormState || !commentDraft.trim() || savingComment) {
      return;
    }

    setSavingComment(true);
    setError(null);

    try {
      const endpoint =
        commentFormState.target === "question"
          ? `/api/doubts/${questionId}/comments`
          : `/api/doubts/${questionId}/answers/${commentFormState.answerId}/comments`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: commentDraft,
          parentId: commentFormState.parentId,
        }),
      });

      const payload = (await response.json()) as { error?: string; comment?: Comment };

      if (!response.ok || !payload.comment) {
        throw new Error(payload.error ?? "Could not add comment");
      }

      const createdComment: Comment = payload.comment;

      setThread((prev) =>
        prev
          ? {
              ...prev,
              comments: [...prev.comments, createdComment],
            }
          : prev
      );
      setCommentDraft("");
      setCommentFormState(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add comment");
    } finally {
      setSavingComment(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-4" aria-busy="true" aria-live="polite">
        <div className="skeleton h-5 w-44 rounded-lg" />
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex gap-4">
            <div className="skeleton h-24 w-14 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex gap-2">
                <span className="skeleton h-6 w-20 rounded-full" />
                <span className="skeleton h-6 w-16 rounded-full" />
              </div>
              <div className="skeleton h-8 w-10/12 rounded-xl" />
              <div className="skeleton h-4 w-full rounded-lg" />
              <div className="skeleton h-4 w-11/12 rounded-lg" />
              <div className="skeleton h-4 w-6/12 rounded-lg" />
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="space-y-3">
            <div className="skeleton h-6 w-36 rounded-lg" />
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="skeleton h-10 w-36 rounded-xl" />
          </div>
        </article>
      </section>
    );
  }

  if (error && !thread) {
    return (
      <div className="space-y-4">
        <Link href="/doubts" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={15} />
          Back to doubts feed
        </Link>
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      </div>
    );
  }

  if (!thread) {
    return null;
  }

  const renderCommentBranch = (
    allComments: Comment[],
    opts: { target: "question" | "answer"; answerId?: string },
    parentId: string | null,
    depth: number
  ): React.ReactNode => {
    const scopedComments = allComments.filter((item) => item.parentId === parentId);

    if (scopedComments.length === 0) {
      return null;
    }

    return (
      <div className={`space-y-3 ${depth > 0 ? "pl-4" : ""}`}>
        {scopedComments.map((comment) => (
          <div key={comment.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3">
            <p className="text-sm leading-relaxed text-[var(--text-primary)]">{comment.body}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <AuthorAvatar author={comment.author} size="h-6 w-6" />
              <span className="font-medium text-[var(--text-primary)]">{comment.author.name}</span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 capitalize">{comment.author.role}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
              <button
                type="button"
                onClick={() =>
                  setCommentFormState({
                    target: opts.target,
                    answerId: opts.answerId,
                    parentId: comment.id,
                  })
                }
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-0.5 hover:bg-[var(--card)]"
              >
                <CornerDownRight size={12} />
                Reply
              </button>
            </div>
            <div className="mt-2">
              {renderCommentBranch(allComments, opts, comment.id, depth + 1)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="page-enter space-y-6">
      <Link href="/doubts" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={15} />
        Back to doubts feed
      </Link>

      {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

      <article className="fade-slide-enter rounded-2xl border border-[var(--accent)]/45 bg-[var(--card)] p-6 shadow-sm">
        <div className="flex gap-4">
          <div className="flex w-14 flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-2">
            <button
              type="button"
              onClick={() => void castQuestionVote("up")}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 ${
                thread.question.userVote === 1 ? "bg-emerald-500/20 text-emerald-300" : "text-[var(--text-secondary)]"
              }`}
            >
              <ThumbsUp size={14} />
            </button>
            <span className="text-sm font-bold text-[var(--text-primary)]">{thread.question.votes.score}</span>
            <button
              type="button"
              onClick={() => void castQuestionVote("down")}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 ${
                thread.question.userVote === -1 ? "bg-red-500/20 text-red-300" : "text-[var(--text-secondary)]"
              }`}
            >
              <ThumbsDown size={14} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 font-medium text-[var(--text-primary)]">{thread.question.subject}</span>
              {thread.question.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-2.5 py-1 text-[var(--text-secondary)]">
                  #{tag}
                </span>
              ))}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{thread.question.title}</h1>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">{thread.question.body}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <AuthorAvatar author={thread.question.author} />
              <span className="font-medium text-[var(--text-primary)]">{thread.question.author.name}</span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-0.5 capitalize">{thread.question.author.role}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(thread.question.createdAt), { addSuffix: true })}</span>
              <span>•</span>
              <span>{new Date(thread.question.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </article>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
          <MessageCircle size={18} />
          Question Thread
        </h2>

        {renderCommentBranch(questionComments, { target: "question" }, null, 0)}

        <button
          type="button"
          onClick={() => setCommentFormState({ target: "question" })}
          className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--card)]"
        >
          Add comment to question
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Answers ({thread.answers.length})</h2>

        {thread.answers.map((answer) => {
          const answerComments = answerCommentsById.get(answer.id) ?? [];

          return (
            <article
              key={answer.id}
              className={`rounded-2xl border bg-[var(--card)] p-5 shadow-sm transition-all duration-300 ${
                topAnswerId === answer.id
                  ? "border-emerald-400/45 shadow-[0_0_0_1px_color-mix(in_srgb,rgba(16,185,129,0.38),transparent)]"
                  : "border-[var(--border)]"
              } ${
                newAnswerIds.includes(answer.id) ? "message-bubble-enter shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)]" : ""
              }`}
            >
              <div className="flex gap-4">
                <div className="flex w-14 flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-2">
                  <button
                    type="button"
                    onClick={() => void castAnswerVote(answer.id, "up")}
                    disabled={answer.isPending}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 ${
                      answer.userVote === 1 ? "bg-emerald-500/20 text-emerald-300" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <ThumbsUp size={14} />
                  </button>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{answer.votes.score}</span>
                  <button
                    type="button"
                    onClick={() => void castAnswerVote(answer.id, "down")}
                    disabled={answer.isPending}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 ${
                      answer.userVote === -1 ? "bg-red-500/20 text-red-300" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <ThumbsDown size={14} />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  {topAnswerId === answer.id ? (
                    <div className="mb-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                      Top answer
                    </div>
                  ) : null}

                  {answer.isPending ? (
                    <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-2 py-0.5 text-xs text-[var(--text-primary)]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                      Posting answer...
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">{answer.body}</p>

                  <div className="mt-4 h-px w-full bg-[var(--border)]" />

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <AuthorAvatar author={answer.author} />
                    <span className="font-medium text-[var(--text-primary)]">{answer.author.name}</span>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-0.5 capitalize">{answer.author.role}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(answer.createdAt), { addSuffix: true })}</span>
                    <span>•</span>
                    <span>{new Date(answer.createdAt).toLocaleString()}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {renderCommentBranch(answerComments, { target: "answer", answerId: answer.id }, null, 0)}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCommentFormState({ target: "answer", answerId: answer.id })}
                    className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--card)]"
                  >
                    Add comment to answer
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {thread.answers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--text-secondary)]">
            No answers yet. Share the first response and help solve this doubt.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Your Answer</h2>
        <form onSubmit={submitAnswer} className="mt-3 space-y-3">
          <textarea
            value={answerDraft}
            onChange={(event) => setAnswerDraft(event.target.value)}
            className="auth-input min-h-32 resize-y"
            placeholder="Write a clear, step-by-step explanation"
            minLength={10}
            required
          />
          <button
            type="submit"
            disabled={savingAnswer}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-70"
          >
            <Send size={14} />
            {savingAnswer ? "Posting..." : "Post Answer"}
          </button>
        </form>
      </section>

      {commentFormState ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="auth-glass-card fade-slide-enter w-full max-w-xl rounded-3xl border border-[var(--border)] p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Add a reply</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Threaded comments keep context organized.</p>

            <form onSubmit={submitComment} className="mt-4 space-y-3">
              <textarea
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                className="auth-input min-h-24 resize-y"
                placeholder="Write your comment"
                minLength={2}
                required
              />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCommentFormState(null);
                    setCommentDraft("");
                  }}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingComment}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-70"
                >
                  {savingComment ? "Posting..." : "Post Comment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <AIDoubtAssistant questionId={questionId} draftTitle={thread.question.title} draftBody={thread.question.body} />
    </section>
  );
}
