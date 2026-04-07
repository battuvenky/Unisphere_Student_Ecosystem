"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, MessageCircle, Plus, Search, Send, Share2, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { getRealtimeSocket } from "@/lib/realtime-client";

type GroupListItem = {
  id: string;
  name: string;
  subject: string;
  description: string;
  accessCode: string;
  membersCount: number;
  latestMessageAt: string;
};

type GroupMessage = {
  id: string;
  groupId: string;
  userId: string;
  type: "text" | "resource";
  text: string;
  resourceTitle: string;
  resourceUrl: string;
  createdAt: string;
  authorName: string;
  isOwn: boolean;
};

type GroupsResponse = {
  groups: GroupListItem[];
};

type GroupMessagesResponse = {
  messages: GroupMessage[];
};

const INITIAL_MESSAGES_WINDOW = 120;
const MESSAGES_WINDOW_STEP = 120;

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(value: string) {
  const diffMs = Date.now() - Date.parse(value);
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function GroupsHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [groupSubject, setGroupSubject] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [visibleMessagesLimit, setVisibleMessagesLimit] = useState(INITIAL_MESSAGES_WINDOW);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollMemoryRef = useRef<Record<string, number>>({});
  const previousGroupIdRef = useRef<string | null>(null);
  const restoredGroupIdRef = useRef<string | null>(null);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [groups, activeGroupId]
  );

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return groups;
    }

    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(normalized) ||
        group.subject.toLowerCase().includes(normalized) ||
        group.description.toLowerCase().includes(normalized)
    );
  }, [groups, query]);

  const visibleMessages = useMemo(() => {
    return messages.slice(-visibleMessagesLimit);
  }, [messages, visibleMessagesLimit]);

  const hasOlderMessages = visibleMessages.length < messages.length;

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/groups", { cache: "no-store" });
      const payload = (await response.json()) as GroupsResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load groups");
        setGroups([]);
        return;
      }

      const nextGroups = (payload as GroupsResponse).groups;
      setGroups(nextGroups);

      if (!activeGroupId && nextGroups.length > 0) {
        setActiveGroupId(nextGroups[0].id);
      }

      if (activeGroupId && !nextGroups.some((group) => group.id === activeGroupId)) {
        setActiveGroupId(nextGroups[0]?.id ?? null);
      }
    } catch {
      setError("Could not connect to groups service");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/messages`, { cache: "no-store" });
      const payload = (await response.json()) as GroupMessagesResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load messages");
        return;
      }

      setMessages((payload as GroupMessagesResponse).messages);
    } catch {
      setError("Could not load group messages");
    }
  };

  useEffect(() => {
    void fetchGroups();
  }, []);

  useEffect(() => {
    if (!activeGroupId) {
      setMessages([]);
      return;
    }

    setVisibleMessagesLimit(INITIAL_MESSAGES_WINDOW);
    restoredGroupIdRef.current = null;
    void fetchMessages(activeGroupId);
  }, [activeGroupId]);

  const storeScrollOffset = (groupId: string) => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    scrollMemoryRef.current[groupId] = Math.max(0, viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight);
  };

  const restoreScrollOffset = (groupId: string) => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    const offsetFromBottom = scrollMemoryRef.current[groupId];
    if (typeof offsetFromBottom !== "number") {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
      shouldAutoScrollRef.current = true;
      return;
    }

    const nextTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight - offsetFromBottom);
    viewport.scrollTo({ top: nextTop, behavior: "auto" });
    shouldAutoScrollRef.current = offsetFromBottom < 80;
  };

  useEffect(() => {
    const previousGroupId = previousGroupIdRef.current;

    if (previousGroupId && previousGroupId !== activeGroupId) {
      storeScrollOffset(previousGroupId);
    }

    previousGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    const updateAutoScroll = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom < 80;
    };

    updateAutoScroll();
    viewport.addEventListener("scroll", updateAutoScroll);

    return () => {
      viewport.removeEventListener("scroll", updateAutoScroll);
    };
  }, [activeGroupId]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport || !activeGroupId) {
      return;
    }

    if (restoredGroupIdRef.current !== activeGroupId) {
      restoreScrollOffset(activeGroupId);
      restoredGroupIdRef.current = activeGroupId;
      return;
    }

    if (!shouldAutoScrollRef.current) {
      return;
    }

    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [activeGroupId, visibleMessages, messages.length]);

  useEffect(() => {
    return () => {
      if (activeGroupId) {
        storeScrollOffset(activeGroupId);
      }
    };
  }, [activeGroupId]);

  const loadOlderMessages = () => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      setVisibleMessagesLimit((current) => current + MESSAGES_WINDOW_STEP);
      return;
    }

    const previousHeight = viewport.scrollHeight;
    const previousTop = viewport.scrollTop;

    setVisibleMessagesLimit((current) => current + MESSAGES_WINDOW_STEP);

    requestAnimationFrame(() => {
      const nextHeight = viewport.scrollHeight;
      viewport.scrollTop = Math.max(0, nextHeight - previousHeight + previousTop);
    });
  };

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) {
      return;
    }

    const handleGroupsChanged = () => {
      void fetchGroups();
    };

    const handleGroupMessage = (payload?: { groupId?: string }) => {
      if (!payload?.groupId) {
        return;
      }

      if (activeGroupId === payload.groupId) {
        void fetchMessages(payload.groupId);
      }

      void fetchGroups();
    };

    socket.on("groups:changed", handleGroupsChanged);
    socket.on("groups:message", handleGroupMessage);
    socket.on("connect", handleGroupsChanged);

    return () => {
      socket.off("groups:changed", handleGroupsChanged);
      socket.off("groups:message", handleGroupMessage);
      socket.off("connect", handleGroupsChanged);
    };
  }, [activeGroupId]);

  const createGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!groupName.trim() || !groupSubject.trim()) {
      setError("Group name and subject are required.");
      return;
    }

    setError(null);

    const response = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: groupName.trim(),
        subject: groupSubject.trim(),
        description: groupDescription.trim() || undefined,
      }),
    });

    const payload = (await response.json()) as { error?: string; group?: GroupListItem };

    if (!response.ok) {
      setError(payload.error ?? "Could not create group");
      return;
    }

    setGroupName("");
    setGroupSubject("");
    setGroupDescription("");
    setShowCreateModal(false);

    await fetchGroups();
    if (payload.group?.id) {
      setActiveGroupId(payload.group.id);
    }
  };

  const joinGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!joinCode.trim()) {
      setError("Access code is required.");
      return;
    }

    setError(null);

    const response = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "join",
        accessCode: joinCode.trim().toUpperCase(),
      }),
    });

    const payload = (await response.json()) as { error?: string; group?: GroupListItem };

    if (!response.ok) {
      setError(payload.error ?? "Could not join group");
      return;
    }

    setJoinCode("");
    setShowJoinModal(false);

    await fetchGroups();
    if (payload.group?.id) {
      setActiveGroupId(payload.group.id);
    }
  };

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeGroupId || !draft.trim() || sending) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${activeGroupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          text: draft.trim(),
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: GroupMessage };

      if (!response.ok) {
        setError(payload.error ?? "Could not send message");
        return;
      }

      const newMessage = payload.message;
      if (newMessage) {
        setMessages((prev) => [...prev, newMessage]);
      }
      setDraft("");
      await fetchGroups();
    } catch {
      setError("Could not send message");
    } finally {
      setSending(false);
    }
  };

  const shareResource = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeGroupId || !resourceUrl.trim() || !resourceTitle.trim()) {
      setError("Resource title and URL are required.");
      return;
    }

    setError(null);

    const response = await fetch(`/api/groups/${activeGroupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "resource",
        text: "Shared a resource",
        resourceTitle: resourceTitle.trim(),
        resourceUrl: resourceUrl.trim(),
      }),
    });

    const payload = (await response.json()) as { error?: string; message?: GroupMessage };

    if (!response.ok) {
      setError(payload.error ?? "Could not share resource");
      return;
    }

    const newMessage = payload.message;
    if (newMessage) {
      setMessages((prev) => [...prev, newMessage]);
    }

    setResourceTitle("");
    setResourceUrl("");
    setShowShareModal(false);
    await fetchGroups();
  };

  return (
    <section className="page-enter h-[calc(100dvh-140px)] min-h-[560px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm md:min-h-[640px]">
      <div className="grid h-full grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-[var(--border)] bg-[var(--surface)]/70 p-4 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold">Study Groups</h1>
              <p className="text-xs text-[var(--text-secondary)]">Collaborate in real time</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowCreateModal(true);
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] transition hover:scale-[1.03]"
              title="Create group"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="relative mt-4">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="auth-input pl-9"
              placeholder="Search groups"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowJoinModal(true);
              }}
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2.5 text-xs font-semibold"
            >
              Join Group
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowShareModal(true);
              }}
              disabled={!activeGroupId}
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2.5 text-xs font-semibold disabled:opacity-50"
            >
              Share Resource
            </button>
          </div>

          <div className="mt-4 space-y-2 overflow-auto pr-1" style={{ maxHeight: "calc(100dvh - 360px)" }}>
            {filteredGroups.map((group) => {
              const isActive = group.id === activeGroupId;
              return (
                <button
                  type="button"
                  key={group.id}
                  onClick={() => setActiveGroupId(group.id)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition-all duration-200 ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)]/15"
                      : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--bg-muted)]"
                  }`}
                >
                  <p className="line-clamp-1 text-sm font-semibold">{group.name}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">{group.subject}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {group.membersCount}
                    </span>
                    <span>{formatRelative(group.latestMessageAt)}</span>
                  </div>
                </button>
              );
            })}

            {!loading && filteredGroups.length === 0 ? (
              <div className="px-3 py-6">
                <EmptyState
                  icon={Users}
                  title="No groups yet 👥"
                  message="Create or join a study group to collaborate with classmates."
                  actionLabel="Create Group"
                  onAction={() => setShowCreateModal(true)}
                />
              </div>
            ) : null}
          </div>
        </aside>

        <div className="flex h-full min-h-0 flex-col">
          <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            {activeGroup ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold">{activeGroup.name}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {activeGroup.subject} • Code {activeGroup.accessCode} • {activeGroup.membersCount} members
                  </p>
                </div>
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                  Live updates every 2s
                </span>
              </>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Select a group to start chatting</p>
            )}
          </header>

          <div
            ref={messagesViewportRef}
            className="chat-messages-scroll flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-transparent to-[var(--bg-muted)]/25 p-4"
          >
            {hasOlderMessages ? (
              <div className="sticky top-0 z-10 flex justify-center pb-1">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur"
                >
                  Load older messages
                </button>
              </div>
            ) : null}

            {visibleMessages.map((message) => (
              <article
                key={message.id}
                className={`message-bubble-enter max-w-[82%] rounded-2xl border px-3 py-2 text-sm transition-all duration-200 ${
                  message.isOwn
                    ? "ml-auto border-[var(--accent)]/40 bg-[var(--accent)]/15"
                    : "border-[var(--border)] bg-[var(--card)]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                  <span className="font-semibold text-[var(--text-secondary)]">{message.authorName}</span>
                  <span className="text-[var(--text-secondary)]">{formatTime(message.createdAt)}</span>
                </div>

                <p className="text-sm">{message.text}</p>

                {message.type === "resource" ? (
                  <a
                    href={message.resourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:brightness-110"
                  >
                    <Share2 size={14} />
                    {message.resourceTitle || "Shared resource"}
                  </a>
                ) : null}
              </article>
            ))}

            {!activeGroup ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--text-secondary)]">
                Pick or create a study group from the sidebar.
              </div>
            ) : null}
          </div>

          <form onSubmit={sendMessage} className="border-t border-[var(--border)] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type your message..."
                className="auth-input min-h-[46px] flex-1 resize-none"
                disabled={!activeGroupId}
                rows={2}
              />
              <button
                type="submit"
                disabled={!activeGroupId || !draft.trim() || sending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-55"
              >
                <Send size={15} />
                Send
              </button>
            </div>
          </form>
        </div>
      </div>

      {error ? (
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-xl border border-rose-500/45 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="text-xl font-semibold">Create Study Group</h3>
            <form className="mt-4 grid gap-3" onSubmit={createGroup}>
              <input className="auth-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" />
              <input className="auth-input" value={groupSubject} onChange={(e) => setGroupSubject(e.target.value)} placeholder="Subject" />
              <textarea
                className="auth-input min-h-24"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Description"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showJoinModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="text-xl font-semibold">Join Group</h3>
            <form className="mt-4 grid gap-3" onSubmit={joinGroup}>
              <input
                className="auth-input uppercase"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Access code"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowJoinModal(false)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showShareModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="text-xl font-semibold">Share Resource</h3>
            <form className="mt-4 grid gap-3" onSubmit={shareResource}>
              <input
                className="auth-input"
                value={resourceTitle}
                onChange={(e) => setResourceTitle(e.target.value)}
                placeholder="Resource title"
              />
              <input
                className="auth-input"
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                placeholder="https://..."
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowShareModal(false)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                  Share
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
