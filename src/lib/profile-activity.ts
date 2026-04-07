import { readFile } from "fs/promises";
import path from "path";

export type ProfileActivityItem = {
  id: string;
  kind: "task" | "resource" | "doubt" | "placement";
  title: string;
  detail: string;
  createdAt: string;
};

type TasksFile = {
  tasks?: Array<{
    id: string;
    userId: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

type ResourcesFile = {
  resources?: Array<{
    id: string;
    title: string;
    subject: string;
    createdAt: string;
    uploadedBy: {
      id: string;
    };
  }>;
};

type DoubtsFile = {
  questions?: Array<{
    id: string;
    title: string;
    createdAt: string;
    author: {
      id: string;
    };
  }>;
  answers?: Array<{
    id: string;
    questionId: string;
    createdAt: string;
    author: {
      id: string;
    };
  }>;
};

type PlacementFile = {
  practiceLogs?: Array<{
    id: string;
    userId: string;
    topic: string;
    problemsSolved: number;
    createdAt: string;
  }>;
  applications?: Array<{
    id: string;
    userId: string;
    company: string;
    role: string;
    status: string;
    updatedAt: string;
  }>;
};

const dataDir = path.join(process.cwd(), "data");

async function readJson<T>(fileName: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(dataDir, fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function listProfileActivity(userId: string): Promise<ProfileActivityItem[]> {
  const [tasksFile, resourcesFile, doubtsFile, placementFile] = await Promise.all([
    readJson<TasksFile>("tasks.json"),
    readJson<ResourcesFile>("resources.json"),
    readJson<DoubtsFile>("doubts.json"),
    readJson<PlacementFile>("placement.json"),
  ]);

  const items: ProfileActivityItem[] = [];

  for (const task of tasksFile?.tasks ?? []) {
    if (task.userId !== userId) {
      continue;
    }

    items.push({
      id: `task-${task.id}`,
      kind: "task",
      title: task.title,
      detail: `Task ${task.status.replace("_", " ")}`,
      createdAt: task.updatedAt || task.createdAt,
    });
  }

  for (const resource of resourcesFile?.resources ?? []) {
    if (resource.uploadedBy.id !== userId) {
      continue;
    }

    items.push({
      id: `resource-${resource.id}`,
      kind: "resource",
      title: resource.title,
      detail: `Uploaded in ${resource.subject}`,
      createdAt: resource.createdAt,
    });
  }

  for (const question of doubtsFile?.questions ?? []) {
    if (question.author.id !== userId) {
      continue;
    }

    items.push({
      id: `question-${question.id}`,
      kind: "doubt",
      title: question.title,
      detail: "Posted a new question",
      createdAt: question.createdAt,
    });
  }

  for (const answer of doubtsFile?.answers ?? []) {
    if (answer.author.id !== userId) {
      continue;
    }

    items.push({
      id: `answer-${answer.id}`,
      kind: "doubt",
      title: "Answered a question",
      detail: `Contribution on thread ${answer.questionId.slice(0, 8)}`,
      createdAt: answer.createdAt,
    });
  }

  for (const log of placementFile?.practiceLogs ?? []) {
    if (log.userId !== userId) {
      continue;
    }

    items.push({
      id: `practice-${log.id}`,
      kind: "placement",
      title: `${log.topic} practice`,
      detail: `Solved ${log.problemsSolved} problems`,
      createdAt: log.createdAt,
    });
  }

  for (const application of placementFile?.applications ?? []) {
    if (application.userId !== userId) {
      continue;
    }

    items.push({
      id: `application-${application.id}`,
      kind: "placement",
      title: `${application.company} - ${application.role}`,
      detail: `Status: ${application.status}`,
      createdAt: application.updatedAt,
    });
  }

  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 25);
}
