import { randomUUID } from "crypto";
import path from "path";
import type { UserRole } from "@/lib/auth/types";
import { loadStore, saveStore } from "@/lib/mongo-store";

export type VoteValue = -1 | 0 | 1;

export type DoubtAuthor = {
  id: string;
  name: string;
  role: UserRole;
};

export type QuestionRecord = {
  id: string;
  userId: string;
  title: string;
  body: string;
  subject: string;
  tags: string[];
  author: DoubtAuthor;
  createdAt: string;
  updatedAt: string;
  votes: {
    up: number;
    down: number;
    score: number;
  };
  userVotes: Record<string, VoteValue>;
};

export type AnswerRecord = {
  id: string;
  questionId: string;
  userId: string;
  body: string;
  author: DoubtAuthor;
  createdAt: string;
  updatedAt: string;
  votes: {
    up: number;
    down: number;
    score: number;
  };
  userVotes: Record<string, VoteValue>;
};

export type CommentRecord = {
  id: string;
  questionId: string;
  answerId: string | null;
  parentId: string | null;
  userId: string;
  body: string;
  author: DoubtAuthor;
  createdAt: string;
  updatedAt: string;
};

export type DoubtSuggestion = {
  id: string;
  title: string;
  subject: string;
  tags: string[];
  score: number;
  answersCount: number;
  snippet: string;
  recommendedAnswer: string | null;
  relatedTopics: string[];
};

type DoubtsStore = {
  questions: QuestionRecord[];
  answers: AnswerRecord[];
  comments: CommentRecord[];
};

const demoQuestionAuthors: DoubtAuthor[] = [
  { id: "demo-student-a", name: "Ananya Sharma", role: "student" },
  { id: "demo-student-b", name: "Rahul Verma", role: "student" },
  { id: "demo-admin-1", name: "Dr. Kavya Menon", role: "admin" },
];

const dataDir = path.join(process.cwd(), "data");
const doubtsFile = path.join(dataDir, "doubts.json");

function nowIso() {
  return new Date().toISOString();
}

function sanitizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5)
    )
  );
}

async function readStore(): Promise<DoubtsStore> {
  const store = await loadStore<DoubtsStore>({
    collectionName: "doubts",
    legacyFilePath: doubtsFile,
    initialValue: { questions: [], answers: [], comments: [] },
  });
  const normalized = normalizeStore(store);
  const changed = seedDemoThread(store);
  if (changed || normalized) {
    await writeStore(store);
  }
  return store;
}

function normalizeStore(store: DoubtsStore): boolean {
  let changed = false;

  for (const question of store.questions) {
    if (!("userId" in question) || !question.userId) {
      question.userId = question.author.id;
      changed = true;
    }
  }

  for (const answer of store.answers) {
    if (!("userId" in answer) || !answer.userId) {
      answer.userId = answer.author.id;
      changed = true;
    }
  }

  for (const comment of store.comments) {
    if (!("userId" in comment) || !comment.userId) {
      comment.userId = comment.author.id;
      changed = true;
    }
  }

  return changed;
}

async function writeStore(store: DoubtsStore) {
  await saveStore({
    collectionName: "doubts",
    legacyFilePath: doubtsFile,
    value: store,
  });
}

function seedDemoThread(store: DoubtsStore): boolean {
  if (store.questions.length > 0) {
    return false;
  }

  const questionOneId = "demo-doubt-q-os-deadlock";
  const questionTwoId = "demo-doubt-q-dp-knapsack";
  const answerOneId = "demo-doubt-a-os-1";
  const answerTwoId = "demo-doubt-a-dp-1";
  const commentOneId = "demo-doubt-c-os-followup";
  const commentTwoId = "demo-doubt-c-dp-tip";

  store.questions.push(
    {
      id: questionOneId,
      userId: demoQuestionAuthors[0].id,
      title: "How do I approach deadlock prevention questions in OS exams?",
      body:
        "I understand the four Coffman conditions, but I get confused when a problem asks which condition to break for prevention. Is there a quick framework to answer this in case studies?",
      subject: "Operating Systems",
      tags: ["deadlock", "os", "exam-prep"],
      author: demoQuestionAuthors[0],
      createdAt: "2026-03-17T09:30:00.000Z",
      updatedAt: "2026-03-17T12:15:00.000Z",
      votes: { up: 7, down: 1, score: 6 },
      userVotes: {
        "demo-student-a": 1,
        "demo-student-b": 1,
        "demo-admin-1": 1,
      },
    },
    {
      id: questionTwoId,
      userId: demoQuestionAuthors[1].id,
      title: "0/1 Knapsack DP: tabulation vs memoization in interviews",
      body:
        "For medium-level interview rounds, should I start with recursion + memoization or jump directly to tabulation? I want an answer structure that is easy to explain under time pressure.",
      subject: "DSA",
      tags: ["dynamic-programming", "knapsack", "interview"],
      author: demoQuestionAuthors[1],
      createdAt: "2026-03-19T16:05:00.000Z",
      updatedAt: "2026-03-20T08:40:00.000Z",
      votes: { up: 10, down: 0, score: 10 },
      userVotes: {
        "demo-student-a": 1,
        "demo-admin-1": 1,
      },
    }
  );

  store.answers.push(
    {
      id: answerOneId,
      questionId: questionOneId,
      userId: demoQuestionAuthors[1].id,
      body:
        "Use this sequence: identify which Coffman condition is easiest to violate in the given system constraints. In OS theory questions, resource ordering (breaking circular wait) is usually the cleanest prevention argument.",
      author: demoQuestionAuthors[1],
      createdAt: "2026-03-17T11:00:00.000Z",
      updatedAt: "2026-03-17T11:00:00.000Z",
      votes: { up: 5, down: 0, score: 5 },
      userVotes: {
        "demo-student-a": 1,
        "demo-admin-1": 1,
      },
    },
    {
      id: answerTwoId,
      questionId: questionTwoId,
      userId: demoQuestionAuthors[0].id,
      body:
        "Start with recursion + memoization for clarity, then mention how to convert to bottom-up tabulation for better control over memory. Interviewers usually like seeing both thought process and optimization awareness.",
      author: demoQuestionAuthors[0],
      createdAt: "2026-03-19T18:20:00.000Z",
      updatedAt: "2026-03-20T08:40:00.000Z",
      votes: { up: 6, down: 0, score: 6 },
      userVotes: {
        "demo-student-b": 1,
        "demo-admin-1": 1,
      },
    }
  );

  store.comments.push(
    {
      id: commentOneId,
      questionId: questionOneId,
      answerId: answerOneId,
      parentId: null,
      userId: demoQuestionAuthors[0].id,
      body: "This framework is super helpful. I will apply it in tomorrow's revision sprint.",
      author: demoQuestionAuthors[0],
      createdAt: "2026-03-17T12:15:00.000Z",
      updatedAt: "2026-03-17T12:15:00.000Z",
    },
    {
      id: commentTwoId,
      questionId: questionTwoId,
      answerId: answerTwoId,
      parentId: null,
      userId: demoQuestionAuthors[2].id,
      body: "Add one line about state definition (index, remaining capacity) before writing transitions.",
      author: demoQuestionAuthors[2],
      createdAt: "2026-03-20T08:40:00.000Z",
      updatedAt: "2026-03-20T08:40:00.000Z",
    }
  );

  return true;
}

function recomputeVoteCounters(voteMap: Record<string, VoteValue>) {
  let up = 0;
  let down = 0;

  for (const value of Object.values(voteMap)) {
    if (value === 1) {
      up += 1;
    } else if (value === -1) {
      down += 1;
    }
  }

  return { up, down, score: up - down };
}

function resolveVote(current: VoteValue, action: "up" | "down" | "clear"): VoteValue {
  if (action === "clear") {
    return 0;
  }

  if (action === "up") {
    return current === 1 ? 0 : 1;
  }

  return current === -1 ? 0 : -1;
}

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function keywordSet(input: string) {
  return new Set(
    normalizeText(input)
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3)
  );
}

function truncate(input: string, max: number) {
  if (input.length <= max) {
    return input;
  }

  return `${input.slice(0, max - 1).trimEnd()}...`;
}

export async function createQuestion(input: {
  title: string;
  body: string;
  subject: string;
  tags: string[];
  author: DoubtAuthor;
}): Promise<QuestionRecord> {
  const store = await readStore();

  const question: QuestionRecord = {
    id: randomUUID(),
    userId: input.author.id,
    title: input.title.trim(),
    body: input.body.trim(),
    subject: input.subject.trim(),
    tags: sanitizeTags(input.tags),
    author: input.author,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    votes: { up: 0, down: 0, score: 0 },
    userVotes: {},
  };

  store.questions.push(question);
  await writeStore(store);
  return question;
}

export async function listQuestions(input?: {
  query?: string;
  subject?: string;
  sort?: "new" | "top" | "unanswered";
}) {
  const store = await readStore();

  const answersByQuestion = new Map<string, number>();
  const answersGroupedByQuestion = new Map<string, AnswerRecord[]>();
  const commentsByQuestion = new Map<string, number>();

  for (const answer of store.answers) {
    answersByQuestion.set(answer.questionId, (answersByQuestion.get(answer.questionId) ?? 0) + 1);

    const currentAnswers = answersGroupedByQuestion.get(answer.questionId) ?? [];
    currentAnswers.push(answer);
    answersGroupedByQuestion.set(answer.questionId, currentAnswers);
  }

  for (const comment of store.comments) {
    commentsByQuestion.set(comment.questionId, (commentsByQuestion.get(comment.questionId) ?? 0) + 1);
  }

  const query = (input?.query ?? "").trim().toLowerCase();
  const subject = (input?.subject ?? "").trim().toLowerCase();
  const sort = input?.sort ?? "new";

  let filtered = store.questions.filter((question) => {
    const matchesQuery =
      !query ||
      question.title.toLowerCase().includes(query) ||
      question.body.toLowerCase().includes(query) ||
      question.tags.some((tag) => tag.includes(query));

    const matchesSubject = !subject || question.subject.toLowerCase() === subject;

    return matchesQuery && matchesSubject;
  });

  if (sort === "top") {
    filtered = filtered.sort((a, b) => b.votes.score - a.votes.score || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } else if (sort === "unanswered") {
    filtered = filtered
      .filter((question) => (answersByQuestion.get(question.id) ?? 0) === 0)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } else {
    filtered = filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  return filtered.map((question) => ({
    ...question,
    topAnswers: (answersGroupedByQuestion.get(question.id) ?? [])
      .sort((a, b) => b.votes.score - a.votes.score || Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 3)
      .map((answer) => ({
        id: answer.id,
        body: answer.body,
        author: answer.author,
        createdAt: answer.createdAt,
        votes: answer.votes,
      })),
    answersCount: answersByQuestion.get(question.id) ?? 0,
    commentsCount: commentsByQuestion.get(question.id) ?? 0,
    lastActivityAt: [
      question.updatedAt,
      ...store.answers.filter((answer) => answer.questionId === question.id).map((answer) => answer.updatedAt),
      ...store.comments.filter((comment) => comment.questionId === question.id).map((comment) => comment.updatedAt),
    ].sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? question.updatedAt,
  }));
}

export async function suggestQuestions(input: {
  query: string;
  body?: string;
  limit?: number;
}) {
  const store = await readStore();
  const limit = Math.max(1, Math.min(input.limit ?? 5, 8));
  const fullQuery = `${input.query} ${input.body ?? ""}`.trim();

  if (fullQuery.length < 6) {
    return [] as DoubtSuggestion[];
  }

  const queryKeywords = keywordSet(fullQuery);
  if (queryKeywords.size === 0) {
    return [] as DoubtSuggestion[];
  }

  const answersByQuestion = new Map<string, AnswerRecord[]>();
  for (const answer of store.answers) {
    const list = answersByQuestion.get(answer.questionId) ?? [];
    list.push(answer);
    answersByQuestion.set(answer.questionId, list);
  }

  const scored = store.questions
    .map((question) => {
      const searchable = [question.title, question.body, question.subject, question.tags.join(" ")].join(" ");
      const searchableKeywords = keywordSet(searchable);

      let overlapCount = 0;
      for (const token of queryKeywords) {
        if (searchableKeywords.has(token)) {
          overlapCount += 1;
        }
      }

      const titleText = normalizeText(question.title);
      const titleBoost = Array.from(queryKeywords).some((token) => titleText.includes(token)) ? 2 : 0;
      const tagBoost = question.tags.some((tag) => queryKeywords.has(tag.toLowerCase())) ? 1 : 0;
      const voteBoost = Math.min(2, Math.max(0, question.votes.score / 5));

      const score = overlapCount + titleBoost + tagBoost + voteBoost;
      return { question, score };
    })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score || Date.parse(b.question.createdAt) - Date.parse(a.question.createdAt))
    .slice(0, limit);

  return scored.map(({ question, score }) => {
    const answers = (answersByQuestion.get(question.id) ?? []).sort((a, b) => b.votes.score - a.votes.score);
    const recommendedAnswer = answers[0] ? truncate(answers[0].body, 170) : null;
    const queryTopicMatches = question.tags.filter((tag) => queryKeywords.has(tag.toLowerCase()));
    const relatedTopics = Array.from(new Set([question.subject, ...queryTopicMatches, ...question.tags])).slice(0, 4);

    return {
      id: question.id,
      title: question.title,
      subject: question.subject,
      tags: question.tags,
      score,
      answersCount: answers.length,
      snippet: truncate(question.body, 160),
      recommendedAnswer,
      relatedTopics,
    } satisfies DoubtSuggestion;
  });
}

export async function getQuestionThread(questionId: string) {
  const store = await readStore();

  const question = store.questions.find((item) => item.id === questionId);
  if (!question) {
    return null;
  }

  const answers = store.answers
    .filter((answer) => answer.questionId === questionId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const comments = store.comments
    .filter((comment) => comment.questionId === questionId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return { question, answers, comments };
}

export async function createAnswer(input: {
  questionId: string;
  body: string;
  author: DoubtAuthor;
}) {
  const store = await readStore();
  const question = store.questions.find((item) => item.id === input.questionId);

  if (!question) {
    return null;
  }

  const answer: AnswerRecord = {
    id: randomUUID(),
    questionId: input.questionId,
    userId: input.author.id,
    body: input.body.trim(),
    author: input.author,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    votes: { up: 0, down: 0, score: 0 },
    userVotes: {},
  };

  store.answers.push(answer);
  question.updatedAt = nowIso();
  await writeStore(store);
  return answer;
}

export async function createComment(input: {
  questionId: string;
  answerId?: string;
  parentId?: string;
  body: string;
  author: DoubtAuthor;
}) {
  const store = await readStore();
  const question = store.questions.find((item) => item.id === input.questionId);

  if (!question) {
    return null;
  }

  if (input.answerId) {
    const answer = store.answers.find((item) => item.id === input.answerId && item.questionId === input.questionId);
    if (!answer) {
      return null;
    }
  }

  if (input.parentId) {
    const parent = store.comments.find((item) => item.id === input.parentId && item.questionId === input.questionId);
    if (!parent) {
      return null;
    }

    if ((input.answerId ?? null) !== parent.answerId) {
      return null;
    }
  }

  const comment: CommentRecord = {
    id: randomUUID(),
    questionId: input.questionId,
    answerId: input.answerId ?? null,
    parentId: input.parentId ?? null,
    userId: input.author.id,
    body: input.body.trim(),
    author: input.author,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  store.comments.push(comment);
  question.updatedAt = nowIso();
  await writeStore(store);
  return comment;
}

export async function voteQuestion(input: {
  questionId: string;
  userId: string;
  action: "up" | "down" | "clear";
}) {
  const store = await readStore();
  const question = store.questions.find((item) => item.id === input.questionId);

  if (!question) {
    return null;
  }

  const current = question.userVotes[input.userId] ?? 0;
  const next = resolveVote(current, input.action);

  if (next === 0) {
    delete question.userVotes[input.userId];
  } else {
    question.userVotes[input.userId] = next;
  }

  question.votes = recomputeVoteCounters(question.userVotes);
  question.updatedAt = nowIso();
  await writeStore(store);

  return {
    votes: question.votes,
    userVote: question.userVotes[input.userId] ?? 0,
  };
}

export async function voteAnswer(input: {
  questionId: string;
  answerId: string;
  userId: string;
  action: "up" | "down" | "clear";
}) {
  const store = await readStore();
  const answer = store.answers.find((item) => item.id === input.answerId && item.questionId === input.questionId);

  if (!answer) {
    return null;
  }

  const current = answer.userVotes[input.userId] ?? 0;
  const next = resolveVote(current, input.action);

  if (next === 0) {
    delete answer.userVotes[input.userId];
  } else {
    answer.userVotes[input.userId] = next;
  }

  answer.votes = recomputeVoteCounters(answer.userVotes);
  answer.updatedAt = nowIso();

  const question = store.questions.find((item) => item.id === input.questionId);
  if (question) {
    question.updatedAt = nowIso();
  }

  await writeStore(store);

  return {
    votes: answer.votes,
    userVote: answer.userVotes[input.userId] ?? 0,
  };
}

export function withUserVote<T extends { userVotes: Record<string, VoteValue> }>(entity: T, userId: string) {
  const { userVotes, ...rest } = entity;
  return {
    ...rest,
    userVote: userVotes[userId] ?? 0,
  };
}

export async function deleteQuestionThread(questionId: string): Promise<boolean> {
  const store = await readStore();
  const exists = store.questions.some((item) => item.id === questionId);

  if (!exists) {
    return false;
  }

  store.questions = store.questions.filter((item) => item.id !== questionId);
  store.answers = store.answers.filter((item) => item.questionId !== questionId);
  store.comments = store.comments.filter((item) => item.questionId !== questionId);
  await writeStore(store);
  return true;
}
