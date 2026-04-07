import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

export type ResourceType = "pdf" | "doc" | "slide" | "image" | "archive" | "other";

export type ResourceRecord = {
  id: string;
  title: string;
  description: string;
  subject: string;
  type: ResourceType;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
  downloads: number;
  createdAt: string;
};

type ResourcesStore = {
  resources: ResourceRecord[];
};

type DemoResourceTemplate = {
  id: string;
  title: string;
  description: string;
  subject: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  content: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
  downloads: number;
  createdAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const uploadsDir = path.join(dataDir, "uploads", "resources");
const resourcesFile = path.join(dataDir, "resources.json");

const demoResources: DemoResourceTemplate[] = [
  {
    id: "demo-resource-os-scheduling",
    title: "Operating Systems CPU Scheduling Cheatsheet",
    description: "Concise FCFS, SJF, RR, and priority scheduling notes with solved examples.",
    subject: "Operating Systems",
    originalFileName: "os-cpu-scheduling-cheatsheet.pdf",
    storedFileName: "demo-os-cpu-scheduling-cheatsheet.pdf",
    mimeType: "application/pdf",
    content:
      "UniSphere Demo Resource\n\nOperating Systems CPU Scheduling Cheatsheet\n- FCFS, SJF, Round Robin\n- Turnaround and waiting time examples\n",
    uploadedBy: {
      id: "demo-student-b",
      name: "Rahul Verma",
      email: "rahul.verma@unisphere.edu",
    },
    downloads: 34,
    createdAt: "2026-03-06T10:20:00.000Z",
  },
  {
    id: "demo-resource-dbms-transactions",
    title: "DBMS Transactions and Normalization Guide",
    description: "Exam-focused notes on ACID, schedules, and normal forms with quick revision tables.",
    subject: "DBMS",
    originalFileName: "dbms-transactions-normalization.pdf",
    storedFileName: "demo-dbms-transactions-normalization.pdf",
    mimeType: "application/pdf",
    content:
      "UniSphere Demo Resource\n\nDBMS Transactions and Normalization Guide\n- ACID properties\n- Conflict serializability\n- 1NF to BCNF quick comparison\n",
    uploadedBy: {
      id: "demo-student-a",
      name: "Ananya Sharma",
      email: "ananya.sharma@unisphere.edu",
    },
    downloads: 22,
    createdAt: "2026-03-10T14:05:00.000Z",
  },
  {
    id: "demo-resource-dsa-sheet",
    title: "Top 75 DSA Interview Roadmap",
    description: "Structured 6-week roadmap with topic-wise progression and checkpoint questions.",
    subject: "DSA",
    originalFileName: "top-75-dsa-roadmap.pdf",
    storedFileName: "demo-top-75-dsa-roadmap.pdf",
    mimeType: "application/pdf",
    content:
      "UniSphere Demo Resource\n\nTop 75 DSA Interview Roadmap\n- Week 1: Arrays and Strings\n- Week 2: Linked Lists and Stacks\n- Week 3: Trees and Heaps\n",
    uploadedBy: {
      id: "demo-admin-1",
      name: "Dr. Kavya Menon",
      email: "admin@unisphere.edu",
    },
    downloads: 48,
    createdAt: "2026-03-14T08:45:00.000Z",
  },
];

function toResourceType(fileName: string, mimeType: string): ResourceType {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType.includes("pdf") || extension === "pdf") {
    return "pdf";
  }

  if (["doc", "docx", "txt", "rtf"].includes(extension)) {
    return "doc";
  }

  if (["ppt", "pptx", "key"].includes(extension)) {
    return "slide";
  }

  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return "image";
  }

  if (["zip", "rar", "7z"].includes(extension)) {
    return "archive";
  }

  return "other";
}

function sanitizeName(fileName: string): string {
  const normalized = fileName.normalize("NFKD");
  return normalized
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(uploadsDir, { recursive: true });

  try {
    await readFile(resourcesFile, "utf8");
  } catch {
    const initial: ResourcesStore = { resources: [] };
    await writeFile(resourcesFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<ResourcesStore> {
  await ensureStoreFile();
  const raw = await readFile(resourcesFile, "utf8");
  const store = JSON.parse(raw) as ResourcesStore;
  const changed = await ensureDemoResources(store);
  if (changed) {
    await writeStore(store);
  }
  return store;
}

async function writeStore(store: ResourcesStore) {
  await writeFile(resourcesFile, JSON.stringify(store, null, 2), "utf8");
}

async function ensureDemoResources(store: ResourcesStore): Promise<boolean> {
  let changed = false;
  const existingIds = new Set(store.resources.map((resource) => resource.id));

  for (const template of demoResources) {
    const filePath = path.join(uploadsDir, template.storedFileName);

    try {
      await readFile(filePath);
    } catch {
      await writeFile(filePath, Buffer.from(template.content, "utf8"));
    }

    if (existingIds.has(template.id)) {
      continue;
    }

    store.resources.push({
      id: template.id,
      title: template.title,
      description: template.description,
      subject: template.subject,
      type: toResourceType(template.originalFileName, template.mimeType),
      originalFileName: template.originalFileName,
      storedFileName: template.storedFileName,
      mimeType: template.mimeType,
      sizeBytes: Buffer.byteLength(template.content, "utf8"),
      uploadedBy: template.uploadedBy,
      downloads: template.downloads,
      createdAt: template.createdAt,
    });
    changed = true;
  }

  return changed;
}

export async function listResources(): Promise<ResourceRecord[]> {
  const store = await readStore();
  return [...store.resources].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function findResourceById(id: string): Promise<ResourceRecord | null> {
  const store = await readStore();
  return store.resources.find((resource) => resource.id === id) ?? null;
}

export async function createResource(input: {
  title: string;
  description: string;
  subject: string;
  file: File;
  uploader: {
    id: string;
    name: string;
    email: string;
  };
}): Promise<ResourceRecord> {
  const store = await readStore();

  const fileBuffer = Buffer.from(await input.file.arrayBuffer());
  const sanitized = sanitizeName(input.file.name || "resource-file");
  const extension = sanitized.includes(".") ? sanitized.split(".").pop() : "bin";
  const id = randomUUID();
  const storedFileName = `${id}.${extension || "bin"}`;
  const filePath = path.join(uploadsDir, storedFileName);

  await writeFile(filePath, fileBuffer);

  const resource: ResourceRecord = {
    id,
    title: input.title.trim(),
    description: input.description.trim(),
    subject: input.subject.trim(),
    type: toResourceType(input.file.name, input.file.type),
    originalFileName: input.file.name,
    storedFileName,
    mimeType: input.file.type || "application/octet-stream",
    sizeBytes: fileBuffer.length,
    uploadedBy: {
      id: input.uploader.id,
      name: input.uploader.name,
      email: input.uploader.email,
    },
    downloads: 0,
    createdAt: new Date().toISOString(),
  };

  store.resources.push(resource);
  await writeStore(store);

  return resource;
}

export async function incrementDownloadCount(id: string): Promise<void> {
  const store = await readStore();
  const resource = store.resources.find((item) => item.id === id);

  if (!resource) {
    return;
  }

  resource.downloads += 1;
  await writeStore(store);
}

export function getResourceAbsolutePath(storedFileName: string): string {
  return path.join(uploadsDir, storedFileName);
}

export async function deleteResourceById(id: string): Promise<boolean> {
  const store = await readStore();
  const resource = store.resources.find((item) => item.id === id);

  if (!resource) {
    return false;
  }

  store.resources = store.resources.filter((item) => item.id !== id);
  await writeStore(store);

  const filePath = getResourceAbsolutePath(resource.storedFileName);
  try {
    await unlink(filePath);
  } catch {
    // Ignore missing file cleanup failures.
  }

  return true;
}
