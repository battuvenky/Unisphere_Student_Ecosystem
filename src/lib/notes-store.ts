import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type NoteCategory =
  | "general"
  | "class"
  | "project"
  | "placement"
  | "personal";

export type NoteRecord = {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: NoteCategory;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

type NotesStore = {
  notes: NoteRecord[];
};

type NoteFilters = {
  query?: string;
  category?: NoteCategory;
  tag?: string;
};

const dataDir = path.join(process.cwd(), "data");
const notesFile = path.join(dataDir, "notes.json");

function nowIso() {
  return new Date().toISOString();
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/\s+/g, "-");
}

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(notesFile, "utf8");
  } catch {
    const initial: NotesStore = { notes: [] };
    await writeFile(notesFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<NotesStore> {
  await ensureStoreFile();
  const raw = await readFile(notesFile, "utf8");
  return JSON.parse(raw) as NotesStore;
}

async function writeStore(store: NotesStore) {
  await writeFile(notesFile, JSON.stringify(store, null, 2), "utf8");
}

async function ensureSeedDataForUser(userId: string): Promise<NotesStore> {
  const store = await readStore();

  if (store.notes.some((note) => note.userId === userId)) {
    return store;
  }

  const now = nowIso();
  const starterNotes: Array<Omit<NoteRecord, "id" | "userId" | "createdAt" | "updatedAt">> = [
    {
      title: "Operating Systems Quick Revision",
      content:
        "## CPU Scheduling\n- FCFS: simple but convoy effect\n- SJF: optimal average waiting time (needs burst estimate)\n\n## Deadlocks\n- Coffman conditions\n- Avoidance with Banker's algorithm",
      category: "class",
      tags: ["os", "revision", "exam"],
      isPinned: true,
    },
    {
      title: "Placement Prep Plan",
      content:
        "- Solve 2 array + 1 graph problem daily\n- Weekly mock every Saturday\n- Track company applications in Placement module",
      category: "placement",
      tags: ["dsa", "interview", "plan"],
      isPinned: false,
    },
    {
      title: "Mini Project Ideas",
      content:
        "1. Campus complaint sentiment analyzer\n2. Group study recommendation engine\n3. Smart attendance + reminder bot",
      category: "project",
      tags: ["ideas", "project"],
      isPinned: false,
    },
  ];

  for (let index = 0; index < starterNotes.length; index += 1) {
    const template = starterNotes[index];
    const createdAt = new Date(Date.now() - (index + 1) * 86_400_000).toISOString();

    store.notes.push({
      id: randomUUID(),
      userId,
      title: template.title,
      content: template.content,
      category: template.category,
      tags: template.tags.map(normalizeTag).filter(Boolean),
      isPinned: template.isPinned,
      createdAt,
      updatedAt: createdAt,
    });
  }

  await writeStore(store);
  return store;
}

export async function listNotes(userId: string, filters?: NoteFilters) {
  const store = await ensureSeedDataForUser(userId);
  const query = (filters?.query ?? "").trim().toLowerCase();
  const tag = normalizeTag(filters?.tag ?? "");

  const notes = store.notes
    .filter((note) => note.userId === userId)
    .filter((note) => {
      const queryMatch =
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags.some((item) => item.includes(query));
      const categoryMatch = !filters?.category || note.category === filters.category;
      const tagMatch = !tag || note.tags.includes(tag);

      return queryMatch && categoryMatch && tagMatch;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });

  const userNotes = store.notes.filter((note) => note.userId === userId);
  const categories: NoteCategory[] = ["general", "class", "project", "placement", "personal"];

  const categoryCounts = categories.map((category) => ({
    category,
    count: userNotes.filter((note) => note.category === category).length,
  }));

  const tagCounts = new Map<string, number>();
  for (const note of userNotes) {
    for (const noteTag of note.tags) {
      tagCounts.set(noteTag, (tagCounts.get(noteTag) ?? 0) + 1);
    }
  }

  const tags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 20);

  return {
    notes,
    summary: {
      total: userNotes.length,
      pinned: userNotes.filter((note) => note.isPinned).length,
      categoryCounts,
      tags,
    },
    filterOptions: {
      categories,
    },
  };
}

export async function createNote(input: {
  userId: string;
  title: string;
  content?: string;
  category?: NoteCategory;
  tags?: string[];
  isPinned?: boolean;
}) {
  const store = await ensureSeedDataForUser(input.userId);
  const now = nowIso();

  const note: NoteRecord = {
    id: randomUUID(),
    userId: input.userId,
    title: input.title.trim(),
    content: (input.content ?? "").trim(),
    category: input.category ?? "general",
    tags: (input.tags ?? []).map(normalizeTag).filter(Boolean),
    isPinned: Boolean(input.isPinned),
    createdAt: now,
    updatedAt: now,
  };

  store.notes.push(note);
  await writeStore(store);

  return note;
}

export async function updateNote(input: {
  userId: string;
  noteId: string;
  patch: Partial<Pick<NoteRecord, "title" | "content" | "category" | "tags" | "isPinned">>;
}) {
  const store = await ensureSeedDataForUser(input.userId);
  const note = store.notes.find((item) => item.id === input.noteId && item.userId === input.userId);

  if (!note) {
    return null;
  }

  if (typeof input.patch.title === "string") {
    note.title = input.patch.title.trim() || note.title;
  }

  if (typeof input.patch.content === "string") {
    note.content = input.patch.content;
  }

  if (typeof input.patch.category === "string") {
    note.category = input.patch.category as NoteCategory;
  }

  if (Array.isArray(input.patch.tags)) {
    note.tags = input.patch.tags.map(normalizeTag).filter(Boolean);
  }

  if (typeof input.patch.isPinned === "boolean") {
    note.isPinned = input.patch.isPinned;
  }

  note.updatedAt = nowIso();
  await writeStore(store);

  return note;
}

export async function deleteNote(input: { userId: string; noteId: string }) {
  const store = await ensureSeedDataForUser(input.userId);
  const previousLength = store.notes.length;

  store.notes = store.notes.filter((item) => !(item.id === input.noteId && item.userId === input.userId));

  if (store.notes.length === previousLength) {
    return false;
  }

  await writeStore(store);
  return true;
}
