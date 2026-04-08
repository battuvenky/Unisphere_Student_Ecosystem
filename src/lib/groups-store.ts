import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { loadStore, saveStore } from "@/lib/mongo-store";

export type GroupMessageType = "text" | "resource";

export type StudyGroup = {
  id: string;
  name: string;
  subject: string;
  description: string;
  ownerId: string;
  accessCode: string;
  createdAt: string;
};

export type GroupMembership = {
  groupId: string;
  userId: string;
  joinedAt: string;
};

export type GroupMessage = {
  id: string;
  groupId: string;
  userId: string;
  type: GroupMessageType;
  text: string;
  resourceTitle: string;
  resourceUrl: string;
  createdAt: string;
};

type GroupsStore = {
  groups: StudyGroup[];
  memberships: GroupMembership[];
  messages: GroupMessage[];
};

const dataDir = path.join(process.cwd(), "data");
const groupsFile = path.join(dataDir, "groups.json");

function nowIso() {
  return new Date().toISOString();
}

function createAccessCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function readStore() {
  return loadStore<GroupsStore>({
    collectionName: "groups",
    legacyFilePath: groupsFile,
    initialValue: {
      groups: [],
      memberships: [],
      messages: [],
    },
  });
}

async function writeStore(store: GroupsStore) {
  await saveStore({
    collectionName: "groups",
    legacyFilePath: groupsFile,
    value: store,
  });
}

async function ensureStarterGroupForUser(userId: string) {
  const store = await readStore();

  const hasMembership = store.memberships.some((membership) => membership.userId === userId);
  if (hasMembership) {
    return store;
  }

  let group = store.groups.find((item) => item.name === "Campus Coding Circle");
  if (!group) {
    group = {
      id: randomUUID(),
      name: "Campus Coding Circle",
      subject: "DSA",
      description: "Daily coding discussion, problem breakdowns, and interview prep.",
      ownerId: userId,
      accessCode: "UNI101",
      createdAt: nowIso(),
    };
    store.groups.push(group);
  }

  store.memberships.push({
    groupId: group.id,
    userId,
    joinedAt: nowIso(),
  });

  if (!store.messages.some((message) => message.groupId === group.id)) {
    store.messages.push(
      {
        id: randomUUID(),
        groupId: group.id,
        userId,
        type: "text",
        text: "Welcome to the study circle. Share your daily target here.",
        resourceTitle: "",
        resourceUrl: "",
        createdAt: nowIso(),
      },
      {
        id: randomUUID(),
        groupId: group.id,
        userId,
        type: "resource",
        text: "Shared a handy revision resource.",
        resourceTitle: "Blind 75 Tracker",
        resourceUrl: "https://neetcode.io/roadmap",
        createdAt: nowIso(),
      }
    );
  }

  await writeStore(store);
  return store;
}

function isMember(store: GroupsStore, groupId: string, userId: string) {
  return store.memberships.some((membership) => membership.groupId === groupId && membership.userId === userId);
}

export async function listGroupsForUser(userId: string) {
  const store = await ensureStarterGroupForUser(userId);

  const memberships = store.memberships.filter((membership) => membership.userId === userId);
  const groups = memberships
    .map((membership) => {
      const group = store.groups.find((item) => item.id === membership.groupId);
      if (!group) {
        return null;
      }

      const membersCount = store.memberships.filter((item) => item.groupId === group.id).length;
      const latestMessage = store.messages
        .filter((message) => message.groupId === group.id)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

      return {
        ...group,
        membersCount,
        latestMessageAt: latestMessage?.createdAt ?? group.createdAt,
      };
    })
    .filter((group): group is NonNullable<typeof group> => group !== null)
    .sort((a, b) => Date.parse(b.latestMessageAt) - Date.parse(a.latestMessageAt));

  return groups;
}

export async function createGroup(input: {
  userId: string;
  name: string;
  subject: string;
  description?: string;
}) {
  const store = await ensureStarterGroupForUser(input.userId);

  const group: StudyGroup = {
    id: randomUUID(),
    name: input.name.trim(),
    subject: input.subject.trim(),
    description: (input.description ?? "").trim(),
    ownerId: input.userId,
    accessCode: createAccessCode(),
    createdAt: nowIso(),
  };

  store.groups.push(group);
  store.memberships.push({
    groupId: group.id,
    userId: input.userId,
    joinedAt: nowIso(),
  });

  await writeStore(store);
  return group;
}

export async function joinGroupWithCode(input: { userId: string; accessCode: string }) {
  const store = await ensureStarterGroupForUser(input.userId);
  const code = input.accessCode.trim().toUpperCase();

  const group = store.groups.find((item) => item.accessCode.toUpperCase() === code);
  if (!group) {
    return { error: "No group found with this access code" as const };
  }

  const alreadyMember = isMember(store, group.id, input.userId);
  if (!alreadyMember) {
    store.memberships.push({
      groupId: group.id,
      userId: input.userId,
      joinedAt: nowIso(),
    });
    await writeStore(store);
  }

  return { group };
}

export async function listGroupMessages(input: { userId: string; groupId: string }) {
  const store = await ensureStarterGroupForUser(input.userId);

  if (!isMember(store, input.groupId, input.userId)) {
    return { error: "You are not a member of this group" as const };
  }

  const messages = store.messages
    .filter((message) => message.groupId === input.groupId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return { messages };
}

export async function sendGroupMessage(input: {
  userId: string;
  groupId: string;
  type: GroupMessageType;
  text: string;
  resourceTitle?: string;
  resourceUrl?: string;
}) {
  const store = await ensureStarterGroupForUser(input.userId);

  if (!isMember(store, input.groupId, input.userId)) {
    return { error: "You are not a member of this group" as const };
  }

  const message: GroupMessage = {
    id: randomUUID(),
    groupId: input.groupId,
    userId: input.userId,
    type: input.type,
    text: input.text.trim(),
    resourceTitle: (input.resourceTitle ?? "").trim(),
    resourceUrl: (input.resourceUrl ?? "").trim(),
    createdAt: nowIso(),
  };

  store.messages.push(message);
  await writeStore(store);

  return { message };
}

export async function listGroupMembers(input: { userId: string; groupId: string }) {
  const store = await ensureStarterGroupForUser(input.userId);

  if (!isMember(store, input.groupId, input.userId)) {
    return [];
  }

  return store.memberships
    .filter((membership) => membership.groupId === input.groupId)
    .map((membership) => ({
      userId: membership.userId,
      joinedAt: membership.joinedAt,
    }));
}
