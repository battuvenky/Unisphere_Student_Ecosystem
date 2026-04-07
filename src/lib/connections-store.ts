import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type DirectMessageType = "text" | "note" | "file";

export type FriendRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt: string | null;
};

export type Friendship = {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  recipientUserId: string;
  type: DirectMessageType;
  text: string;
  title: string;
  url: string;
  createdAt: string;
  deliveredAt: string | null;
  seenAt: string | null;
};

type ConnectionsStore = {
  requests: FriendRequest[];
  friendships: Friendship[];
  messages: DirectMessage[];
};

const dataDir = path.join(process.cwd(), "data");
const storeFile = path.join(dataDir, "connections.json");

function nowIso() {
  return new Date().toISOString();
}

function makeConversationId(a: string, b: string) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join("::");
}

function samePair(a1: string, b1: string, a2: string, b2: string) {
  return (a1 === a2 && b1 === b2) || (a1 === b2 && b1 === a2);
}

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(storeFile, "utf8");
  } catch {
    const seededAt = nowIso();
    const initial: ConnectionsStore = {
      requests: [
        {
          id: randomUUID(),
          fromUserId: "demo-student-a",
          toUserId: "demo-admin-1",
          status: "pending",
          createdAt: seededAt,
          respondedAt: null,
        },
      ],
      friendships: [
        {
          id: randomUUID(),
          userAId: "demo-student-a",
          userBId: "demo-student-b",
          createdAt: seededAt,
        },
      ],
      messages: [
        {
          id: randomUUID(),
          conversationId: makeConversationId("demo-student-a", "demo-student-b"),
          senderUserId: "demo-student-a",
          recipientUserId: "demo-student-b",
          type: "text",
          text: "Hey Rahul, can you review my DBMS notes before tomorrow?",
          title: "",
          url: "",
          createdAt: seededAt,
          deliveredAt: seededAt,
          seenAt: null,
        },
        {
          id: randomUUID(),
          conversationId: makeConversationId("demo-student-a", "demo-student-b"),
          senderUserId: "demo-student-b",
          recipientUserId: "demo-student-a",
          type: "text",
          text: "Sure. Share the doc and I will add comments tonight.",
          title: "",
          url: "",
          createdAt: new Date(Date.now() + 5000).toISOString(),
          deliveredAt: new Date(Date.now() + 5000).toISOString(),
          seenAt: null,
        },
      ],
    };

    await writeFile(storeFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStoreFile();
  const raw = await readFile(storeFile, "utf8");
  const store = JSON.parse(raw) as ConnectionsStore;
  let changed = false;

  store.messages = store.messages.map((message) => {
    if (typeof message.deliveredAt !== "undefined" && typeof message.seenAt !== "undefined") {
      return message;
    }

    changed = true;
    return {
      ...message,
      deliveredAt: message.deliveredAt ?? null,
      seenAt: message.seenAt ?? null,
    };
  });

  if (changed) {
    await writeStore(store);
  }

  return store;
}

async function writeStore(store: ConnectionsStore) {
  await writeFile(storeFile, JSON.stringify(store, null, 2), "utf8");
}

function areFriends(store: ConnectionsStore, userId: string, otherUserId: string) {
  return store.friendships.some((friendship) => samePair(friendship.userAId, friendship.userBId, userId, otherUserId));
}

function hasPendingRequestBetween(store: ConnectionsStore, userId: string, otherUserId: string) {
  return store.requests.some(
    (request) =>
      request.status === "pending" &&
      samePair(request.fromUserId, request.toUserId, userId, otherUserId)
  );
}

function ensureFriendship(store: ConnectionsStore, userAId: string, userBId: string) {
  if (areFriends(store, userAId, userBId)) {
    return;
  }

  store.friendships.push({
    id: randomUUID(),
    userAId,
    userBId,
    createdAt: nowIso(),
  });
}

export async function listFriendRequests(userId: string) {
  const store = await readStore();

  const incoming = store.requests
    .filter((request) => request.toUserId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const outgoing = store.requests
    .filter((request) => request.fromUserId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return { incoming, outgoing };
}

export async function listFriends(userId: string) {
  const store = await readStore();

  const friends = store.friendships
    .filter((friendship) => friendship.userAId === userId || friendship.userBId === userId)
    .map((friendship) => ({
      friendship,
      friendUserId: friendship.userAId === userId ? friendship.userBId : friendship.userAId,
    }));

  return friends
    .map((item) => {
      const conversationId = makeConversationId(userId, item.friendUserId);
      const latestMessage = store.messages
        .filter((message) => message.conversationId === conversationId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

      return {
        friendshipId: item.friendship.id,
        friendUserId: item.friendUserId,
        connectedAt: item.friendship.createdAt,
        latestMessageAt: latestMessage?.createdAt ?? item.friendship.createdAt,
      };
    })
    .sort((a, b) => Date.parse(b.latestMessageAt) - Date.parse(a.latestMessageAt));
}

export async function sendFriendRequest(input: { fromUserId: string; toUserId: string }) {
  const store = await readStore();

  if (input.fromUserId === input.toUserId) {
    return { error: "You cannot send a request to yourself" as const };
  }

  if (areFriends(store, input.fromUserId, input.toUserId)) {
    return { error: "You are already connected" as const };
  }

  if (hasPendingRequestBetween(store, input.fromUserId, input.toUserId)) {
    return { error: "A pending request already exists" as const };
  }

  const request: FriendRequest = {
    id: randomUUID(),
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    status: "pending",
    createdAt: nowIso(),
    respondedAt: null,
  };

  store.requests.push(request);
  await writeStore(store);
  return { request };
}

export async function respondToFriendRequest(input: {
  requestId: string;
  userId: string;
  action: "accept" | "reject" | "cancel";
}) {
  const store = await readStore();
  const request = store.requests.find((item) => item.id === input.requestId);

  if (!request) {
    return { error: "Request not found" as const };
  }

  if (request.status !== "pending") {
    return { error: "Request is no longer active" as const };
  }

  if (input.action === "cancel") {
    if (request.fromUserId !== input.userId) {
      return { error: "Only the sender can cancel this request" as const };
    }

    request.status = "cancelled";
    request.respondedAt = nowIso();
    await writeStore(store);
    return { request };
  }

  if (request.toUserId !== input.userId) {
    return { error: "Only the recipient can respond to this request" as const };
  }

  request.status = input.action === "accept" ? "accepted" : "rejected";
  request.respondedAt = nowIso();

  if (input.action === "accept") {
    ensureFriendship(store, request.fromUserId, request.toUserId);
  }

  await writeStore(store);
  return { request };
}

export async function listSuggestedUsers(input: { userId: string; candidateUserIds: string[] }) {
  const store = await readStore();

  const connectedIds = new Set(
    store.friendships
      .filter((friendship) => friendship.userAId === input.userId || friendship.userBId === input.userId)
      .map((friendship) => (friendship.userAId === input.userId ? friendship.userBId : friendship.userAId))
  );

  const blockedByPending = new Set(
    store.requests
      .filter(
        (request) =>
          request.status === "pending" &&
          (request.fromUserId === input.userId || request.toUserId === input.userId)
      )
      .map((request) => (request.fromUserId === input.userId ? request.toUserId : request.fromUserId))
  );

  return input.candidateUserIds.filter(
    (candidateId) =>
      candidateId !== input.userId &&
      !connectedIds.has(candidateId) &&
      !blockedByPending.has(candidateId)
  );
}

export async function listConversation(input: { userId: string; friendUserId: string }) {
  const store = await readStore();

  if (!areFriends(store, input.userId, input.friendUserId)) {
    return { error: "You can only chat with connected friends" as const };
  }

  const conversationId = makeConversationId(input.userId, input.friendUserId);
  const messages = store.messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return { conversationId, messages };
}

export async function sendDirectMessage(input: {
  senderUserId: string;
  recipientUserId: string;
  type: DirectMessageType;
  text?: string;
  title?: string;
  url?: string;
}) {
  const store = await readStore();

  if (!areFriends(store, input.senderUserId, input.recipientUserId)) {
    return { error: "You can only chat with connected friends" as const };
  }

  const text = input.text?.trim() ?? "";
  const title = input.title?.trim() ?? "";
  const url = input.url?.trim() ?? "";

  if (input.type === "text" && text.length === 0) {
    return { error: "Message is required" as const };
  }

  if (input.type !== "text" && title.length === 0) {
    return { error: "Shared item title is required" as const };
  }

  if (input.type !== "text" && url.length === 0) {
    return { error: "Shared item URL is required" as const };
  }

  const message: DirectMessage = {
    id: randomUUID(),
    conversationId: makeConversationId(input.senderUserId, input.recipientUserId),
    senderUserId: input.senderUserId,
    recipientUserId: input.recipientUserId,
    type: input.type,
    text,
    title,
    url,
    createdAt: nowIso(),
    deliveredAt: null,
    seenAt: null,
  };

  store.messages.push(message);
  await writeStore(store);

  return { message };
}

export async function markMessageDelivered(input: {
  messageId: string;
  recipientUserId: string;
}) {
  const store = await readStore();
  const message = store.messages.find((item) => item.id === input.messageId);

  if (!message) {
    return { error: "Message not found" as const };
  }

  if (message.recipientUserId !== input.recipientUserId) {
    return { error: "Not allowed" as const };
  }

  if (!message.deliveredAt) {
    message.deliveredAt = nowIso();
    await writeStore(store);
  }

  return { message };
}

export async function markConversationSeen(input: {
  viewerUserId: string;
  friendUserId: string;
}) {
  const store = await readStore();

  if (!areFriends(store, input.viewerUserId, input.friendUserId)) {
    return { error: "You can only chat with connected friends" as const };
  }

  const conversationId = makeConversationId(input.viewerUserId, input.friendUserId);
  const updates: DirectMessage[] = [];

  for (const message of store.messages) {
    if (
      message.conversationId === conversationId &&
      message.senderUserId === input.friendUserId &&
      message.recipientUserId === input.viewerUserId
    ) {
      let changed = false;
      if (!message.deliveredAt) {
        message.deliveredAt = nowIso();
        changed = true;
      }
      if (!message.seenAt) {
        message.seenAt = nowIso();
        changed = true;
      }
      if (changed) {
        updates.push(message);
      }
    }
  }

  if (updates.length > 0) {
    await writeStore(store);
  }

  return { updates, conversationId };
}
