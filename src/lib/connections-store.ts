import { randomUUID } from "crypto";
import { connectMongoose } from "@/lib/mongoose";
import { MessageModel } from "@/lib/models/message";
import { UserModel } from "@/lib/models/user";

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

type UserRequestEdge = {
  id: string;
  userId: string;
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt: string | null;
};

type ConnectionsUserDoc = {
  appId: string;
  friends?: string[];
  requests?: {
    incoming?: UserRequestEdge[];
    outgoing?: UserRequestEdge[];
  };
};

function nowIso() {
  return new Date().toISOString();
}

function makeConversationId(a: string, b: string) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join("::");
}

function normalizeEdges(edges: unknown): UserRequestEdge[] {
  if (!Array.isArray(edges)) {
    return [];
  }

  return edges
    .map((item) => {
      const edge = item as Partial<UserRequestEdge>;
      if (!edge?.id || !edge?.userId || !edge?.status || !edge?.createdAt) {
        return null;
      }

      return {
        id: String(edge.id),
        userId: String(edge.userId),
        status: edge.status as FriendRequestStatus,
        createdAt: String(edge.createdAt),
        respondedAt: typeof edge.respondedAt === "string" ? edge.respondedAt : null,
      };
    })
    .filter((item): item is UserRequestEdge => item !== null);
}

function normalizeUserDoc(doc: Partial<ConnectionsUserDoc> | null): ConnectionsUserDoc | null {
  if (!doc?.appId) {
    return null;
  }

  return {
    appId: String(doc.appId),
    friends: Array.isArray(doc.friends) ? doc.friends.map((item) => String(item)) : [],
    requests: {
      incoming: normalizeEdges(doc.requests?.incoming),
      outgoing: normalizeEdges(doc.requests?.outgoing),
    },
  };
}

async function getConnectionsUser(userId: string) {
  await connectMongoose();
  const doc = await UserModel.findOne({ appId: userId })
    .select({ appId: 1, friends: 1, requests: 1 })
    .lean<Partial<ConnectionsUserDoc> | null>();
  return normalizeUserDoc(doc);
}

function edgeToRequest(edge: UserRequestEdge, ownerUserId: string, kind: "incoming" | "outgoing"): FriendRequest {
  if (kind === "incoming") {
    return {
      id: edge.id,
      fromUserId: edge.userId,
      toUserId: ownerUserId,
      status: edge.status,
      createdAt: edge.createdAt,
      respondedAt: edge.respondedAt,
    };
  }

  return {
    id: edge.id,
    fromUserId: ownerUserId,
    toUserId: edge.userId,
    status: edge.status,
    createdAt: edge.createdAt,
    respondedAt: edge.respondedAt,
  };
}

function extractAcceptedAt(user: ConnectionsUserDoc, friendUserId: string) {
  const acceptedIncoming = (user.requests?.incoming ?? []).filter(
    (edge) => edge.userId === friendUserId && edge.status === "accepted"
  );
  const acceptedOutgoing = (user.requests?.outgoing ?? []).filter(
    (edge) => edge.userId === friendUserId && edge.status === "accepted"
  );

  const all = [...acceptedIncoming, ...acceptedOutgoing]
    .map((edge) => edge.respondedAt ?? edge.createdAt)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a));

  return all[0] ?? nowIso();
}

async function areUsersFriends(userId: string, otherUserId: string) {
  const user = await getConnectionsUser(userId);
  if (!user) {
    return false;
  }

  return (user.friends ?? []).includes(otherUserId);
}

function mapMessageDocument(
  doc: {
    _id?: unknown;
    senderId?: string;
    receiverId?: string;
    message?: string;
    type?: DirectMessageType;
    title?: string;
    url?: string;
    timestamp?: string;
    deliveredAt?: string | null;
    seenAt?: string | null;
  }
): DirectMessage {
  const senderId = doc.senderId ?? "";
  const receiverId = doc.receiverId ?? "";

  return {
    id: String(doc._id ?? ""),
    conversationId: makeConversationId(senderId, receiverId),
    senderUserId: senderId,
    recipientUserId: receiverId,
    type: (doc.type ?? "text") as DirectMessageType,
    text: doc.message ?? "",
    title: doc.title ?? "",
    url: doc.url ?? "",
    createdAt: doc.timestamp ?? nowIso(),
    deliveredAt: doc.deliveredAt ?? null,
    seenAt: doc.seenAt ?? null,
  };
}

export async function listFriendRequests(userId: string) {
  const user = await getConnectionsUser(userId);
  if (!user) {
    return { incoming: [], outgoing: [] };
  }

  const incoming = (user.requests?.incoming ?? [])
    .map((edge) => edgeToRequest(edge, userId, "incoming"))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const outgoing = (user.requests?.outgoing ?? [])
    .map((edge) => edgeToRequest(edge, userId, "outgoing"))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return { incoming, outgoing };
}

export async function listFriends(userId: string) {
  const user = await getConnectionsUser(userId);
  if (!user) {
    return [];
  }

  const friendIds = user.friends ?? [];

  const latestMessages = await Promise.all(
    friendIds.map(async (friendUserId) => {
      const doc = await MessageModel.findOne({
        $or: [
          { senderId: userId, receiverId: friendUserId },
          { senderId: friendUserId, receiverId: userId },
        ],
      })
        .sort({ timestamp: -1 })
        .select({ timestamp: 1 })
        .lean<{ timestamp?: string } | null>();

      return {
        friendUserId,
        latestMessageAt: doc?.timestamp ?? null,
      };
    })
  );

  const latestMap = new Map(latestMessages.map((item) => [item.friendUserId, item.latestMessageAt]));

  return friendIds
    .map((friendUserId) => {
      const connectedAt = extractAcceptedAt(user, friendUserId);
      return {
        friendshipId: makeConversationId(userId, friendUserId),
        friendUserId,
        connectedAt,
        latestMessageAt: latestMap.get(friendUserId) ?? connectedAt,
      };
    })
    .sort((a, b) => Date.parse(b.latestMessageAt) - Date.parse(a.latestMessageAt));
}

export async function sendFriendRequest(input: { fromUserId: string; toUserId: string }) {
  const [fromUser, toUser] = await Promise.all([
    getConnectionsUser(input.fromUserId),
    getConnectionsUser(input.toUserId),
  ]);

  if (!fromUser || !toUser) {
    return { error: "User not found" as const };
  }

  if (input.fromUserId === input.toUserId) {
    return { error: "You cannot send a request to yourself" as const };
  }

  if ((fromUser.friends ?? []).includes(input.toUserId) || (toUser.friends ?? []).includes(input.fromUserId)) {
    return { error: "You are already connected" as const };
  }

  const fromOutgoing = fromUser.requests?.outgoing ?? [];
  const fromIncoming = fromUser.requests?.incoming ?? [];
  const hasPending = [...fromOutgoing, ...fromIncoming].some(
    (edge) => edge.userId === input.toUserId && edge.status === "pending"
  );

  if (hasPending) {
    return { error: "A pending request already exists" as const };
  }

  const request: UserRequestEdge = {
    id: randomUUID(),
    userId: input.toUserId,
    status: "pending",
    createdAt: nowIso(),
    respondedAt: null,
  };

  const reciprocal: UserRequestEdge = {
    id: request.id,
    userId: input.fromUserId,
    status: "pending",
    createdAt: request.createdAt,
    respondedAt: null,
  };

  const nextOutgoing = [...(fromUser.requests?.outgoing ?? []), request];
  const nextIncoming = [...(toUser.requests?.incoming ?? []), reciprocal];

  await Promise.all([
    UserModel.updateOne({ appId: input.fromUserId }, { $set: { "requests.outgoing": nextOutgoing } }),
    UserModel.updateOne({ appId: input.toUserId }, { $set: { "requests.incoming": nextIncoming } }),
  ]);

  return {
    request: {
      id: request.id,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      status: request.status,
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
    },
  };
}

export async function respondToFriendRequest(input: {
  requestId: string;
  userId: string;
  action: "accept" | "reject" | "cancel";
}) {
  await connectMongoose();

  const [senderUser, recipientUser] = await Promise.all([
    UserModel.findOne({ "requests.outgoing.id": input.requestId })
      .select({ appId: 1, friends: 1, requests: 1 })
      .lean<Partial<ConnectionsUserDoc> | null>(),
    UserModel.findOne({ "requests.incoming.id": input.requestId })
      .select({ appId: 1, friends: 1, requests: 1 })
      .lean<Partial<ConnectionsUserDoc> | null>(),
  ]);

  const sender = normalizeUserDoc(senderUser);
  const recipient = normalizeUserDoc(recipientUser);

  if (!sender || !recipient) {
    return { error: "Request not found" as const };
  }

  const senderOutgoing = [...(sender.requests?.outgoing ?? [])];
  const recipientIncoming = [...(recipient.requests?.incoming ?? [])];

  const outgoingIndex = senderOutgoing.findIndex((item) => item.id === input.requestId);
  const incomingIndex = recipientIncoming.findIndex((item) => item.id === input.requestId);

  if (outgoingIndex < 0 || incomingIndex < 0) {
    return { error: "Request not found" as const };
  }

  const outgoingRequest = senderOutgoing[outgoingIndex];
  const incomingRequest = recipientIncoming[incomingIndex];

  if (outgoingRequest.status !== "pending" || incomingRequest.status !== "pending") {
    return { error: "Request is no longer active" as const };
  }

  if (input.action === "cancel") {
    if (sender.appId !== input.userId) {
      return { error: "Only the sender can cancel this request" as const };
    }

    const respondedAt = nowIso();
    senderOutgoing[outgoingIndex] = { ...outgoingRequest, status: "cancelled", respondedAt };
    recipientIncoming[incomingIndex] = { ...incomingRequest, status: "cancelled", respondedAt };

    await Promise.all([
      UserModel.updateOne({ appId: sender.appId }, { $set: { "requests.outgoing": senderOutgoing } }),
      UserModel.updateOne({ appId: recipient.appId }, { $set: { "requests.incoming": recipientIncoming } }),
    ]);

    return {
      request: {
        id: outgoingRequest.id,
        fromUserId: sender.appId,
        toUserId: recipient.appId,
        status: "cancelled",
        createdAt: outgoingRequest.createdAt,
        respondedAt,
      },
    };
  }

  if (recipient.appId !== input.userId) {
    return { error: "Only the recipient can respond to this request" as const };
  }

  const nextStatus: FriendRequestStatus = input.action === "accept" ? "accepted" : "rejected";
  const respondedAt = nowIso();
  senderOutgoing[outgoingIndex] = { ...outgoingRequest, status: nextStatus, respondedAt };
  recipientIncoming[incomingIndex] = { ...incomingRequest, status: nextStatus, respondedAt };

  if (input.action === "accept") {
    await Promise.all([
      UserModel.updateOne(
        { appId: sender.appId },
        {
          $set: { "requests.outgoing": senderOutgoing },
          $addToSet: { friends: recipient.appId },
        }
      ),
      UserModel.updateOne(
        { appId: recipient.appId },
        {
          $set: { "requests.incoming": recipientIncoming },
          $addToSet: { friends: sender.appId },
        }
      ),
    ]);
  } else {
    await Promise.all([
      UserModel.updateOne({ appId: sender.appId }, { $set: { "requests.outgoing": senderOutgoing } }),
      UserModel.updateOne({ appId: recipient.appId }, { $set: { "requests.incoming": recipientIncoming } }),
    ]);
  }

  return {
    request: {
      id: outgoingRequest.id,
      fromUserId: sender.appId,
      toUserId: recipient.appId,
      status: nextStatus,
      createdAt: outgoingRequest.createdAt,
      respondedAt,
    },
  };
}

export async function listSuggestedUsers(input: { userId: string; candidateUserIds: string[] }) {
  const user = await getConnectionsUser(input.userId);
  if (!user) {
    return [];
  }

  const connectedIds = new Set(user.friends ?? []);
  const pendingIncoming = (user.requests?.incoming ?? [])
    .filter((edge) => edge.status === "pending")
    .map((edge) => edge.userId);
  const pendingOutgoing = (user.requests?.outgoing ?? [])
    .filter((edge) => edge.status === "pending")
    .map((edge) => edge.userId);
  const blockedByPending = new Set([...pendingIncoming, ...pendingOutgoing]);

  return input.candidateUserIds.filter(
    (candidateId) =>
      candidateId !== input.userId &&
      !connectedIds.has(candidateId) &&
      !blockedByPending.has(candidateId)
  );
}

export async function listConversation(input: { userId: string; friendUserId: string }) {
  const isFriend = await areUsersFriends(input.userId, input.friendUserId);
  if (!isFriend) {
    return { error: "You can only chat with connected friends" as const };
  }

  await connectMongoose();

  const docs = await MessageModel.find({
    $or: [
      { senderId: input.userId, receiverId: input.friendUserId },
      { senderId: input.friendUserId, receiverId: input.userId },
    ],
  })
    .sort({ timestamp: 1 })
    .lean<
      Array<{
        _id: unknown;
        senderId: string;
        receiverId: string;
        message: string;
        type: DirectMessageType;
        title: string;
        url: string;
        timestamp: string;
        deliveredAt?: string | null;
        seenAt?: string | null;
      }>
    >();

  const messages = docs.map((doc) => mapMessageDocument(doc));

  return {
    conversationId: makeConversationId(input.userId, input.friendUserId),
    messages,
  };
}

export async function sendDirectMessage(input: {
  senderUserId: string;
  recipientUserId: string;
  type: DirectMessageType;
  text?: string;
  title?: string;
  url?: string;
}) {
  const isFriend = await areUsersFriends(input.senderUserId, input.recipientUserId);
  if (!isFriend) {
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

  await connectMongoose();
  const timestamp = nowIso();

  const created = await MessageModel.create({
    senderId: input.senderUserId,
    receiverId: input.recipientUserId,
    message: text,
    type: input.type,
    title,
    url,
    timestamp,
    deliveredAt: null,
    seenAt: null,
  });

  return {
    message: {
      id: String(created._id),
      conversationId: makeConversationId(input.senderUserId, input.recipientUserId),
      senderUserId: input.senderUserId,
      recipientUserId: input.recipientUserId,
      type: input.type,
      text,
      title,
      url,
      createdAt: timestamp,
      deliveredAt: null,
      seenAt: null,
    },
  };
}

export async function markMessageDelivered(input: {
  messageId: string;
  recipientUserId: string;
}) {
  await connectMongoose();

  const message = await MessageModel.findById(input.messageId).lean<{
    _id: unknown;
    senderId: string;
    receiverId: string;
    message: string;
    type: DirectMessageType;
    title: string;
    url: string;
    timestamp: string;
    deliveredAt?: string | null;
    seenAt?: string | null;
  } | null>();

  if (!message) {
    return { error: "Message not found" as const };
  }

  if (message.receiverId !== input.recipientUserId) {
    return { error: "Not allowed" as const };
  }

  if (!message.deliveredAt) {
    const deliveredAt = nowIso();
    await MessageModel.updateOne({ _id: message._id }, { $set: { deliveredAt } });
    message.deliveredAt = deliveredAt;
  }

  return {
    message: {
      id: String(message._id),
      conversationId: makeConversationId(message.senderId, message.receiverId),
      senderUserId: message.senderId,
      recipientUserId: message.receiverId,
      type: message.type,
      text: message.message,
      title: message.title,
      url: message.url,
      createdAt: message.timestamp,
      deliveredAt: message.deliveredAt ?? null,
      seenAt: message.seenAt ?? null,
    },
  };
}

export async function markConversationSeen(input: {
  viewerUserId: string;
  friendUserId: string;
}) {
  const isFriend = await areUsersFriends(input.viewerUserId, input.friendUserId);
  if (!isFriend) {
    return { error: "You can only chat with connected friends" as const };
  }

  await connectMongoose();

  const docs = await MessageModel.find({
    senderId: input.friendUserId,
    receiverId: input.viewerUserId,
    $or: [{ deliveredAt: null }, { seenAt: null }],
  }).lean<
    Array<{
      _id: unknown;
      senderId: string;
      receiverId: string;
      message: string;
      type: DirectMessageType;
      title: string;
      url: string;
      timestamp: string;
      deliveredAt?: string | null;
      seenAt?: string | null;
    }>
  >();

  const updates: DirectMessage[] = [];

  for (const doc of docs) {
    const deliveredAt = doc.deliveredAt ?? nowIso();
    const seenAt = doc.seenAt ?? nowIso();

    await MessageModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          deliveredAt,
          seenAt,
        },
      }
    );

    updates.push({
      id: String(doc._id),
      conversationId: makeConversationId(doc.senderId, doc.receiverId),
      senderUserId: doc.senderId,
      recipientUserId: doc.receiverId,
      type: doc.type,
      text: doc.message,
      title: doc.title,
      url: doc.url,
      createdAt: doc.timestamp,
      deliveredAt,
      seenAt,
    });
  }

  return {
    updates,
    conversationId: makeConversationId(input.viewerUserId, input.friendUserId),
  };
}
