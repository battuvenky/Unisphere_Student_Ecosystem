"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, MessageCircle, Search, Send, Share2, UserPlus, UsersRound, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { getRealtimeSocket } from "@/lib/realtime-client";

type ConnectionUser = {
  id: string;
  fullName: string;
  email: string;
  role: "student" | "admin";
  department: string;
  year: string;
  specialization: string;
  avatar: string;
};

type FriendRecord = {
  friendshipId: string;
  friendUserId: string;
  connectedAt: string;
  latestMessageAt: string;
  profile: ConnectionUser | null;
};

type RequestIncoming = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
  respondedAt: string | null;
  fromUser: ConnectionUser | null;
};

type RequestOutgoing = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
  respondedAt: string | null;
  toUser: ConnectionUser | null;
};

type ConnectionsResponse = {
  currentUserId: string;
  friends: FriendRecord[];
  requests: {
    incoming: RequestIncoming[];
    outgoing: RequestOutgoing[];
  };
  suggested: ConnectionUser[];
};

type DirectMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  recipientUserId: string;
  type: "text" | "note" | "file";
  text: string;
  title: string;
  url: string;
  createdAt: string;
  isOwn: boolean;
  deliveredAt: string | null;
  seenAt: string | null;
};

type NotesListResponse = {
  notes: Array<{ id: string; title: string; category: string; updatedAt: string }>;
};

type ResourcesListResponse = {
  resources: Array<{ id: string; title: string; subject: string; downloadUrl: string }>;
};

const INITIAL_MESSAGES_WINDOW = 140;
const MESSAGES_WINDOW_STEP = 120;

function formatRelative(value: string) {
  const diffMs = Date.now() - Date.parse(value);
  const mins = Math.floor(diffMs / 60_000);

  if (mins < 1) {
    return "just now";
  }

  if (mins < 60) {
    return `${mins}m ago`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, query: string) {
  const cleanText = text.trim();
  if (!cleanText) {
    return text;
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .slice(0, 6);

  if (terms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${terms.map((term) => escapeRegExp(term)).join("|")})`, "gi");
  const segments = text.split(pattern);

  return segments.map((segment, index) => {
    const isMatched = terms.some((term) => term === segment.toLowerCase());
    return isMatched ? (
      <mark key={`${segment}-${index}`} className="rounded bg-[var(--accent)]/18 px-0.5 text-[var(--text-primary)]">
        {segment}
      </mark>
    ) : (
      <span key={`${segment}-${index}`}>{segment}</span>
    );
  });
}

export function ConnectionsHub() {
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [incoming, setIncoming] = useState<RequestIncoming[]>([]);
  const [outgoing, setOutgoing] = useState<RequestOutgoing[]>([]);
  const [suggested, setSuggested] = useState<ConnectionUser[]>([]);

  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isFriendTyping, setIsFriendTyping] = useState(false);

  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);
  const [visibleMessagesLimit, setVisibleMessagesLimit] = useState(INITIAL_MESSAGES_WINDOW);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [requestSearchQuery, setRequestSearchQuery] = useState("");
  const [connectSearchQuery, setConnectSearchQuery] = useState("");

  const [showSharePanel, setShowSharePanel] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: string; title: string; category: string; updatedAt: string }>>([]);
  const [resources, setResources] = useState<Array<{ id: string; title: string; subject: string; downloadUrl: string }>>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEmittedTypingRef = useRef(false);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollMemoryRef = useRef<Record<string, number>>({});
  const previousConversationIdRef = useRef<string>("");
  const restoredConversationIdRef = useRef<string>("");

  const lastSeenOwnMessageId = useMemo(() => {
    const ownSeen = messages.filter((message) => message.isOwn && Boolean(message.seenAt));

    if (ownSeen.length === 0) {
      return null;
    }

    ownSeen.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return ownSeen[ownSeen.length - 1]?.id ?? null;
  }, [messages]);

  const conversationId = useMemo(() => {
    if (!currentUserId || !activeFriendId) {
      return "";
    }

    return [currentUserId, activeFriendId].sort((a, b) => a.localeCompare(b)).join("::");
  }, [currentUserId, activeFriendId]);

  const activeFriend = useMemo(
    () => friends.find((item) => item.friendUserId === activeFriendId) ?? null,
    [friends, activeFriendId]
  );

  const pendingIncoming = useMemo(() => incoming.filter((req) => req.status === "pending"), [incoming]);

  const filteredFriends = useMemo(() => {
    const query = friendSearchQuery.trim().toLowerCase();
    if (!query) {
      return friends;
    }

    return friends.filter((friend) => {
      const name = friend.profile?.fullName?.toLowerCase() ?? "";
      const department = friend.profile?.department?.toLowerCase() ?? "";
      return name.includes(query) || department.includes(query);
    });
  }, [friends, friendSearchQuery]);

  const filteredPendingIncoming = useMemo(() => {
    const query = requestSearchQuery.trim().toLowerCase();
    if (!query) {
      return pendingIncoming;
    }

    return pendingIncoming.filter((request) => {
      const name = request.fromUser?.fullName?.toLowerCase() ?? "";
      const department = request.fromUser?.department?.toLowerCase() ?? "";
      return name.includes(query) || department.includes(query);
    });
  }, [pendingIncoming, requestSearchQuery]);

  const filteredSuggested = useMemo(() => {
    const query = connectSearchQuery.trim().toLowerCase();
    if (!query) {
      return suggested;
    }

    return suggested.filter((person) => {
      const name = person.fullName.toLowerCase();
      const department = person.department.toLowerCase();
      const specialization = person.specialization.toLowerCase();
      return name.includes(query) || department.includes(query) || specialization.includes(query);
    });
  }, [suggested, connectSearchQuery]);

  const visibleMessages = useMemo(() => {
    return messages.slice(-visibleMessagesLimit);
  }, [messages, visibleMessagesLimit]);

  const hasOlderMessages = visibleMessages.length < messages.length;

  const loadConnections = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/connections", { cache: "no-store" });
      const payload = (await response.json()) as ConnectionsResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load connections");
        setFriends([]);
        setIncoming([]);
        setOutgoing([]);
        setSuggested([]);
        return;
      }

      const next = payload as ConnectionsResponse;
      setCurrentUserId(next.currentUserId);
      setFriends(next.friends);
      setIncoming(next.requests.incoming);
      setOutgoing(next.requests.outgoing);
      setSuggested(next.suggested);

      if (!activeFriendId && next.friends.length > 0) {
        setActiveFriendId(next.friends[0].friendUserId);
      }

      if (activeFriendId && !next.friends.some((item) => item.friendUserId === activeFriendId)) {
        setActiveFriendId(next.friends[0]?.friendUserId ?? null);
      }
    } catch {
      setError("Could not connect to social service");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadMessages = async (friendId: string, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setMessagesLoading(true);
    }

    try {
      const response = await fetch(`/api/connections/messages/${friendId}`, { cache: "no-store" });
      const payload = (await response.json()) as { messages?: DirectMessage[]; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Could not load chat messages");
        setMessages([]);
        return;
      }

      setMessages(payload.messages ?? []);

      await fetch(`/api/connections/messages/${friendId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seen" }),
      });
    } catch {
      setError("Could not load chat conversation");
      setMessages([]);
    } finally {
      if (!silent) {
        setMessagesLoading(false);
      }
    }
  };

  const loadShareData = async () => {
    try {
      const [notesResponse, resourcesResponse] = await Promise.all([
        fetch("/api/notes", { cache: "no-store" }),
        fetch("/api/resources", { cache: "no-store" }),
      ]);

      if (notesResponse.ok) {
        const notesPayload = (await notesResponse.json()) as NotesListResponse;
        setNotes(notesPayload.notes ?? []);
      }

      if (resourcesResponse.ok) {
        const resourcesPayload = (await resourcesResponse.json()) as ResourcesListResponse;
        setResources(resourcesPayload.resources ?? []);
      }
    } catch {
      // Keep share panel functional even if prefetch fails.
    }
  };

  useEffect(() => {
    void loadConnections();
  }, []);

  useEffect(() => {
    if (!activeFriendId) {
      setMessages([]);
      setIsFriendTyping(false);
      return;
    }

    setVisibleMessagesLimit(INITIAL_MESSAGES_WINDOW);
    restoredConversationIdRef.current = "";
    void loadMessages(activeFriendId);
  }, [activeFriendId]);

  const storeScrollOffset = (conversationKey: string) => {
    const viewport = messagesViewportRef.current;
    if (!viewport || !conversationKey) {
      return;
    }

    scrollMemoryRef.current[conversationKey] = Math.max(
      0,
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    );
  };

  const restoreScrollOffset = (conversationKey: string) => {
    const viewport = messagesViewportRef.current;
    if (!viewport || !conversationKey) {
      return;
    }

    const offsetFromBottom = scrollMemoryRef.current[conversationKey];
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
    const previousConversationId = previousConversationIdRef.current;

    if (previousConversationId && previousConversationId !== conversationId) {
      storeScrollOffset(previousConversationId);
    }

    previousConversationIdRef.current = conversationId;
  }, [conversationId]);

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
  }, [activeFriendId]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport || !conversationId) {
      return;
    }

    if (restoredConversationIdRef.current !== conversationId) {
      restoreScrollOffset(conversationId);
      restoredConversationIdRef.current = conversationId;
      return;
    }

    if (!shouldAutoScrollRef.current) {
      return;
    }

    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [conversationId, visibleMessages, messages.length]);

  useEffect(() => {
    return () => {
      if (conversationId) {
        storeScrollOffset(conversationId);
      }
    };
  }, [conversationId]);

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

    const refreshConnections = () => {
      void loadConnections({ silent: true });
    };

    const handleMessage = (payload?: { senderUserId?: string; recipientUserId?: string; messageId?: string }) => {
      if (!payload || !activeFriendId) {
        return;
      }

      if (payload.senderUserId === activeFriendId || payload.recipientUserId === activeFriendId) {
        void loadMessages(activeFriendId, { silent: true });
        setIsFriendTyping(false);

        if (payload.recipientUserId === currentUserId && payload.senderUserId === activeFriendId && payload.messageId) {
          void fetch(`/api/connections/messages/${activeFriendId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delivered", messageId: payload.messageId }),
          });
        }
      }

      void loadConnections({ silent: true });
    };

    const handleTyping = (payload?: {
      fromUserId?: string;
      toUserId?: string;
      conversationId?: string;
      isTyping?: boolean;
    }) => {
      if (!payload || !activeFriendId || !currentUserId) {
        return;
      }

      if (payload.fromUserId !== activeFriendId || payload.toUserId !== currentUserId) {
        return;
      }

      if (payload.conversationId && conversationId && payload.conversationId !== conversationId) {
        return;
      }

      setIsFriendTyping(Boolean(payload.isTyping));
    };

    const handleMessageStatus = (payload?: {
      conversationId?: string;
      messageId?: string;
      deliveredAt?: string | null;
      seenAt?: string | null;
    }) => {
      if (!payload?.messageId || (payload.conversationId && conversationId && payload.conversationId !== conversationId)) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === payload.messageId
            ? {
                ...message,
                deliveredAt: payload.deliveredAt ?? message.deliveredAt,
                seenAt: payload.seenAt ?? message.seenAt,
              }
            : message
        )
      );
    };

    socket.on("connections:requests", refreshConnections);
    socket.on("connections:friends", refreshConnections);
    socket.on("connections:message", handleMessage);
    socket.on("connections:typing", handleTyping);
    socket.on("connections:message-status", handleMessageStatus);
    socket.on("connect", refreshConnections);

    return () => {
      socket.off("connections:requests", refreshConnections);
      socket.off("connections:friends", refreshConnections);
      socket.off("connections:message", handleMessage);
      socket.off("connections:typing", handleTyping);
      socket.off("connections:message-status", handleMessageStatus);
      socket.off("connect", refreshConnections);
    };
  }, [activeFriendId, currentUserId, conversationId]);

  const renderMessageStatus = (message: DirectMessage) => {
    if (!message.isOwn) {
      return null;
    }

    if (message.seenAt) {
      return <span className="text-sky-200">✓✓ Seen</span>;
    }

    if (message.deliveredAt) {
      return <span className="text-white/85">✓✓ Delivered</span>;
    }

    return <span className="text-white/75">✓ Sent</span>;
  };

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket || !currentUserId || !activeFriendId) {
      return;
    }

    const draft = messageDraft.trim();

    if (!draft) {
      if (hasEmittedTypingRef.current) {
        socket.emit("connections:typing", {
          fromUserId: currentUserId,
          toUserId: activeFriendId,
          conversationId,
          isTyping: false,
        });
        hasEmittedTypingRef.current = false;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    if (!hasEmittedTypingRef.current) {
      socket.emit("connections:typing", {
        fromUserId: currentUserId,
        toUserId: activeFriendId,
        conversationId,
        isTyping: true,
      });
      hasEmittedTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("connections:typing", {
        fromUserId: currentUserId,
        toUserId: activeFriendId,
        conversationId,
        isTyping: false,
      });
      hasEmittedTypingRef.current = false;
      typingTimeoutRef.current = null;
    }, 1200);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [messageDraft, currentUserId, activeFriendId, conversationId]);

  const sendRequest = async (targetUserId: string) => {
    setSendingRequestId(targetUserId);
    setError(null);

    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Could not send request");
        return;
      }

      await loadConnections({ silent: true });
    } catch {
      setError("Could not send friend request");
    } finally {
      setSendingRequestId(null);
    }
  };

  const updateRequest = async (requestId: string, action: "accept" | "reject" | "cancel") => {
    setError(null);

    try {
      const response = await fetch(`/api/connections/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Could not update friend request");
        return;
      }

      await loadConnections({ silent: true });
    } catch {
      setError("Could not update friend request");
    }
  };

  const sendMessage = async () => {
    if (!activeFriendId) {
      return;
    }

    const content = messageDraft.trim();
    if (!content || sendingMessage) {
      return;
    }

    setSendingMessage(true);
    setError(null);

    const socket = getRealtimeSocket();
    if (socket && hasEmittedTypingRef.current && currentUserId) {
      socket.emit("connections:typing", {
        fromUserId: currentUserId,
        toUserId: activeFriendId,
        conversationId,
        isTyping: false,
      });
      hasEmittedTypingRef.current = false;
    }

    try {
      const response = await fetch(`/api/connections/messages/${activeFriendId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "text", text: content }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Could not send message");
        return;
      }

      setMessageDraft("");
      await loadMessages(activeFriendId, { silent: true });
      await loadConnections({ silent: true });
    } catch {
      setError("Could not send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const sendShare = async (input: { type: "note" | "file"; title: string; url: string; text?: string }) => {
    if (!activeFriendId) {
      return;
    }

    setSendingMessage(true);
    setError(null);

    try {
      const response = await fetch(`/api/connections/messages/${activeFriendId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Could not share item");
        return;
      }

      setShowSharePanel(false);
      await loadMessages(activeFriendId, { silent: true });
      await loadConnections({ silent: true });
    } catch {
      setError("Could not share item");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-4 shadow-[0_20px_60px_rgba(2,8,20,0.08)] md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Build your UniSphere network, accept requests, and chat in real time.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
            {friends.length} friends · {pendingIncoming.length} pending requests
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 shadow-sm dark:border-rose-800/50 dark:bg-rose-900/25 dark:text-rose-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-[0_16px_45px_rgba(2,8,20,0.06)]">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Friends</div>

          <label className="relative mb-3 block px-1">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="search"
              value={friendSearchQuery}
              onChange={(event) => setFriendSearchQuery(event.target.value)}
              placeholder="Search name or department"
              className="auth-input pl-9 text-sm"
            />
          </label>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="skeleton h-14 rounded-2xl" />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No friends yet"
                  message="Send a request from the suggestions panel and start chatting."
            />
          ) : filteredFriends.length === 0 ? (
            <p className="fade-slide-enter rounded-2xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--text-secondary)]">
              No friends match this search.
            </p>
          ) : (
            <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
              {filteredFriends.map((friend) => {
                const profile = friend.profile;
                const isActive = friend.friendUserId === activeFriendId;

                return (
                  <button
                    type="button"
                    key={friend.friendUserId}
                    onClick={() => setActiveFriendId(friend.friendUserId)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all duration-200 ${
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/50"
                    }`}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xs font-semibold text-[var(--accent)]">
                      {profile?.avatar ?? "??"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 block text-sm font-semibold text-[var(--text-primary)]">
                        {highlightMatch(profile?.fullName ?? "Unknown", friendSearchQuery)}
                      </span>
                      <span className="line-clamp-1 block text-xs text-[var(--text-secondary)]">
                        {highlightMatch(profile?.department ?? "General", friendSearchQuery)}
                      </span>
                      <span className="block text-xs text-[var(--text-secondary)]">{formatRelative(friend.latestMessageAt)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/96 shadow-[0_18px_50px_rgba(2,8,20,0.08)]">
          <div className="flex min-h-[70dvh] flex-col lg:min-h-[62dvh]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">
                  {activeFriend?.profile?.avatar ?? "??"}
                </span>
                <div>
                  {activeFriend ? (
                    <>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{activeFriend.profile?.fullName ?? "Unknown"}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {activeFriend.profile?.department} · {activeFriend.profile?.year}
                      </p>
                      {isFriendTyping ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]">
                          <span className="typing-dot" />
                          <span className="typing-dot [animation-delay:120ms]" />
                          <span className="typing-dot [animation-delay:240ms]" />
                          typing...
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">No friend selected</p>
                      <p className="text-xs text-[var(--text-secondary)]">Choose a friend to start chatting.</p>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setShowSharePanel((prev) => !prev);
                  if (!showSharePanel) {
                    await loadShareData();
                  }
                }}
                disabled={!activeFriendId}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"
              >
                <Share2 size={14} /> Share
              </button>
            </div>

            <div
              ref={messagesViewportRef}
              className="chat-messages-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4 scroll-smooth"
            >
              {!activeFriend ? (
                <EmptyState
                  icon={MessageCircle}
                  title="No friend selected"
                  message="Select a friend from the sidebar to open your chat window."
                />
              ) : messagesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="skeleton h-16 rounded-2xl" />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <EmptyState
                  icon={MessageCircle}
                  title="No messages yet"
                  message="Start the conversation with a quick hello."
                />
              ) : (
                <>
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
                  <div key={message.id} className={`flex flex-col ${message.isOwn ? "items-end" : "items-start"}`}>
                    <div
                      className={`message-bubble-enter max-w-[82%] rounded-2xl border px-3 py-2 shadow-sm ${
                        message.isOwn
                          ? "border-[var(--accent)]/40 bg-[var(--accent)] text-white"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)]"
                      }`}
                    >
                      {message.type !== "text" ? (
                        <a
                          href={message.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`block rounded-xl border px-3 py-2 text-xs font-semibold ${
                            message.isOwn
                              ? "border-white/35 bg-white/15 text-white"
                              : "border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-primary)]"
                          }`}
                        >
                          {message.type === "note" ? "Shared Note" : "Shared File"}: {message.title}
                        </a>
                      ) : null}
                      {message.text ? <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p> : null}
                      <div className={`mt-1 flex items-center gap-2 text-[10px] ${message.isOwn ? "text-white/80" : "text-[var(--text-secondary)]"}`}>
                        <span>{formatRelative(message.createdAt)}</span>
                        {renderMessageStatus(message)}
                      </div>
                    </div>

                    {message.isOwn && message.id === lastSeenOwnMessageId && message.seenAt ? (
                      <p className="mt-1 pr-1 text-[10px] text-[var(--text-secondary)]">Seen {formatRelative(message.seenAt)}</p>
                    ) : null}
                  </div>
                  ))}
                </>
              )}
            </div>

            {showSharePanel && activeFriend ? (
              <div className="border-t border-[var(--border)] bg-[var(--card)]/70 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Quick Share</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">Share a note</p>
                      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                        {notes.slice(0, 6).map((note) => (
                          <button
                            key={note.id}
                            type="button"
                            onClick={() =>
                              void sendShare({
                                type: "note",
                                title: note.title,
                                url: `${window.location.origin}/notes`,
                                text: `Category: ${note.category}`,
                              })
                            }
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-left text-xs hover:border-[var(--accent)]/50"
                          >
                            {note.title}
                          </button>
                        ))}
                        {notes.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">No notes available.</p> : null}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">Share a resource</p>
                      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                        {resources.slice(0, 6).map((resource) => (
                          <button
                            key={resource.id}
                            type="button"
                            onClick={() =>
                              void sendShare({
                                type: "file",
                                title: resource.title,
                                url: `${window.location.origin}${resource.downloadUrl}`,
                                text: `Subject: ${resource.subject}`,
                              })
                            }
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-left text-xs hover:border-[var(--accent)]/50"
                          >
                            {resource.title}
                          </button>
                        ))}
                        {resources.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">No resources available.</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
            ) : null}

            <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  rows={2}
                  placeholder={activeFriendId ? "Write a message..." : "Select a friend to start chatting"}
                  disabled={!activeFriendId}
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!activeFriendId || sendingMessage || !messageDraft.trim()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-sm transition-all duration-200 disabled:opacity-60"
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-[0_12px_36px_rgba(2,8,20,0.06)]">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              <Clock3 size={14} /> Requests
            </div>

            <label className="relative mb-3 block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="search"
                value={requestSearchQuery}
                onChange={(event) => setRequestSearchQuery(event.target.value)}
                placeholder="Search pending by name/department"
                className="auth-input pl-9 text-sm"
              />
            </label>

            <div className="space-y-2">
              {filteredPendingIncoming.map((request) => (
                <div key={request.id} className="fade-slide-enter rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {highlightMatch(request.fromUser?.fullName ?? "Unknown", requestSearchQuery)}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {highlightMatch(request.fromUser?.department ?? "General", requestSearchQuery)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void updateRequest(request.id, "accept")}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      <Check size={12} /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateRequest(request.id, "reject")}
                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))}

              {pendingIncoming.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--text-secondary)]">
                  No pending requests.
                </p>
              ) : filteredPendingIncoming.length === 0 ? (
                <p className="fade-slide-enter rounded-2xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--text-secondary)]">
                  No pending requests match this search.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-[0_12px_36px_rgba(2,8,20,0.06)]">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              <UserPlus size={14} /> Suggested
            </div>

            <label className="relative mb-3 block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="search"
                value={connectSearchQuery}
                onChange={(event) => setConnectSearchQuery(event.target.value)}
                placeholder="Search connect by name/department"
                className="auth-input pl-9 text-sm"
              />
            </label>

            <div className="space-y-2">
              {filteredSuggested.slice(0, 6).map((person) => (
                <div key={person.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{highlightMatch(person.fullName, connectSearchQuery)}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{highlightMatch(`${person.department} · ${person.year}`, connectSearchQuery)}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">{highlightMatch(person.specialization || "General", connectSearchQuery)}</p>
                  <button
                    type="button"
                    onClick={() => void sendRequest(person.id)}
                    disabled={sendingRequestId === person.id}
                    className="mt-2 inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-60"
                  >
                    <UserPlus size={12} /> {sendingRequestId === person.id ? "Sending..." : "Connect"}
                  </button>
                </div>
              ))}

              {suggested.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--text-secondary)]">
                  You are connected with everyone available.
                </p>
              ) : filteredSuggested.length === 0 ? (
                <p className="fade-slide-enter rounded-2xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--text-secondary)]">
                  No connect suggestions match this search.
                </p>
              ) : null}
            </div>
          </div>

          {outgoing.filter((req) => req.status === "pending").length > 0 ? (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-[0_12px_36px_rgba(2,8,20,0.06)]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Sent requests</p>
              <div className="space-y-2">
                {outgoing
                  .filter((req) => req.status === "pending")
                  .slice(0, 5)
                  .map((request) => (
                    <div key={request.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{request.toUser?.fullName ?? "Unknown"}</p>
                      <button
                        type="button"
                        onClick={() => void updateRequest(request.id, "cancel")}
                        className="mt-2 inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                      >
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
