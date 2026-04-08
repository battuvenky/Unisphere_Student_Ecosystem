import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { loadStore, saveStore } from "@/lib/mongo-store";

export type AnnouncementRecord = {
  id: string;
  title: string;
  message: string;
  createdBy: {
    id: string;
    name: string;
  };
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

type AnnouncementsStore = {
  announcements: AnnouncementRecord[];
};

const dataDir = path.join(process.cwd(), "data");
const announcementsFile = path.join(dataDir, "announcements.json");

async function readStore(): Promise<AnnouncementsStore> {
  return loadStore<AnnouncementsStore>({
    collectionName: "announcements",
    legacyFilePath: announcementsFile,
    initialValue: {
      announcements: [
        {
          id: "demo-announcement-orientation",
          title: "Campus Orientation Week",
          message: "Orientation activities begin Monday 9:00 AM in the main auditorium. Attendance is mandatory for first-year students.",
          createdBy: {
            id: "demo-admin-1",
            name: "Dr. Kavya Menon",
          },
          isPinned: true,
          createdAt: "2026-03-28T09:00:00.000Z",
          updatedAt: "2026-03-28T09:00:00.000Z",
        },
      ],
    },
  });
}

async function writeStore(store: AnnouncementsStore) {
  await saveStore({
    collectionName: "announcements",
    legacyFilePath: announcementsFile,
    value: store,
  });
}

export async function listAnnouncements(): Promise<AnnouncementRecord[]> {
  const store = await readStore();
  return [...store.announcements].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export async function createAnnouncement(input: {
  title: string;
  message: string;
  createdBy: {
    id: string;
    name: string;
  };
  isPinned?: boolean;
}): Promise<AnnouncementRecord> {
  const store = await readStore();

  const record: AnnouncementRecord = {
    id: randomUUID(),
    title: input.title.trim(),
    message: input.message.trim(),
    createdBy: input.createdBy,
    isPinned: Boolean(input.isPinned),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.announcements.push(record);
  await writeStore(store);
  return record;
}

export async function updateAnnouncementById(
  id: string,
  patch: Partial<Pick<AnnouncementRecord, "title" | "message" | "isPinned">>
): Promise<AnnouncementRecord | null> {
  const store = await readStore();
  const record = store.announcements.find((item) => item.id === id);

  if (!record) {
    return null;
  }

  if (typeof patch.title === "string") {
    record.title = patch.title.trim();
  }

  if (typeof patch.message === "string") {
    record.message = patch.message.trim();
  }

  if (typeof patch.isPinned === "boolean") {
    record.isPinned = patch.isPinned;
  }

  record.updatedAt = new Date().toISOString();
  await writeStore(store);
  return record;
}

export async function deleteAnnouncementById(id: string): Promise<boolean> {
  const store = await readStore();
  const next = store.announcements.filter((item) => item.id !== id);

  if (next.length === store.announcements.length) {
    return false;
  }

  store.announcements = next;
  await writeStore(store);
  return true;
}
