import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { loadStore, saveStore } from "@/lib/mongo-store";

export type ExpenseCategory =
  | "food"
  | "travel"
  | "academics"
  | "hostel"
  | "entertainment"
  | "utilities"
  | "other";

export type ExpenseRecord = {
  id: string;
  userId: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  note: string;
  splitEnabled: boolean;
  splitFriends: string[];
  splitPerFriend: number;
  settledFriends: string[];
  createdAt: string;
  updatedAt: string;
};

type ExpensesStore = {
  expenses: ExpenseRecord[];
};

type ExpenseFilters = {
  query?: string;
  category?: ExpenseCategory;
  type?: "all" | "personal" | "split";
  month?: string;
};

const dataDir = path.join(process.cwd(), "data");
const expensesFile = path.join(dataDir, "expenses.json");

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentMonthIso() {
  return new Date().toISOString().slice(0, 7);
}

function toMonth(dateIso: string) {
  return dateIso.slice(0, 7);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeQuery(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

async function readStore(): Promise<ExpensesStore> {
  return loadStore<ExpensesStore>({
    collectionName: "expenses",
    legacyFilePath: expensesFile,
    initialValue: { expenses: [] },
  });
}

async function writeStore(store: ExpensesStore) {
  await saveStore({
    collectionName: "expenses",
    legacyFilePath: expensesFile,
    value: store,
  });
}

async function ensureSeedDataForUser(userId: string): Promise<ExpensesStore> {
  const store = await readStore();

  const hasData = store.expenses.some((entry) => entry.userId === userId);
  if (hasData) {
    return store;
  }

  const templates: Array<Omit<ExpenseRecord, "id" | "userId" | "createdAt" | "updatedAt">> = [
    {
      title: "Mess fee installment",
      amount: 2400,
      category: "hostel",
      date: addDaysIso(-10),
      note: "Monthly mess contribution",
      splitEnabled: false,
      splitFriends: [],
      splitPerFriend: 0,
      settledFriends: [],
    },
    {
      title: "Cab to coding contest",
      amount: 360,
      category: "travel",
      date: addDaysIso(-6),
      note: "Shared ride to venue",
      splitEnabled: true,
      splitFriends: ["Rahul", "Aisha"],
      splitPerFriend: roundMoney(360 / 3),
      settledFriends: ["Rahul"],
    },
    {
      title: "DSA premium sheet",
      amount: 499,
      category: "academics",
      date: addDaysIso(-3),
      note: "One-time purchase",
      splitEnabled: false,
      splitFriends: [],
      splitPerFriend: 0,
      settledFriends: [],
    },
    {
      title: "Weekend groceries",
      amount: 820,
      category: "food",
      date: addDaysIso(-1),
      note: "Snacks + fruits",
      splitEnabled: true,
      splitFriends: ["Meera"],
      splitPerFriend: roundMoney(820 / 2),
      settledFriends: [],
    },
  ];

  const createdAt = nowIso();
  for (const template of templates) {
    store.expenses.push({
      ...template,
      id: randomUUID(),
      userId,
      createdAt,
      updatedAt: createdAt,
    });
  }

  await writeStore(store);
  return store;
}

export async function listExpenses(userId: string, filters?: ExpenseFilters) {
  const store = await ensureSeedDataForUser(userId);

  const query = normalizeQuery(filters?.query);
  const month = filters?.month || currentMonthIso();

  const allUserExpenses = store.expenses
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const filtered = allUserExpenses.filter((entry) => {
    const queryMatch =
      !query ||
      entry.title.toLowerCase().includes(query) ||
      entry.note.toLowerCase().includes(query) ||
      entry.splitFriends.some((friend) => friend.toLowerCase().includes(query));

    const categoryMatch = !filters?.category || entry.category === filters.category;

    const typeMatch =
      !filters?.type ||
      filters.type === "all" ||
      (filters.type === "split" ? entry.splitEnabled : !entry.splitEnabled);

    const monthMatch = !month || toMonth(entry.date) === month;

    return queryMatch && categoryMatch && typeMatch && monthMatch;
  });

  const totalSpent = filtered.reduce((sum, entry) => sum + entry.amount, 0);
  const totalRecoverable = filtered
    .filter((entry) => entry.splitEnabled)
    .reduce(
      (sum, entry) =>
        sum +
        entry.splitFriends
          .filter((friend) => !entry.settledFriends.includes(friend))
          .reduce((friendSum) => friendSum + entry.splitPerFriend, 0),
      0
    );

  const personalSpent = roundMoney(totalSpent - totalRecoverable);

  const splitExpenseEntries = filtered.filter((entry) => entry.splitEnabled);
  const splitFriendsTotal = splitExpenseEntries.reduce((sum, entry) => sum + entry.splitFriends.length, 0);
  const settledCount = splitExpenseEntries.reduce((sum, entry) => sum + entry.settledFriends.length, 0);
  const settlementRate = splitFriendsTotal > 0 ? Math.round((settledCount / splitFriendsTotal) * 100) : 0;

  const categoryTotals = (
    ["food", "travel", "academics", "hostel", "entertainment", "utilities", "other"] as ExpenseCategory[]
  )
    .map((category) => ({
      category,
      amount: roundMoney(filtered.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.amount, 0)),
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const monthlySeries = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const monthKey = date.toISOString().slice(0, 7);
    const amount = allUserExpenses
      .filter((entry) => toMonth(entry.date) === monthKey)
      .reduce((sum, entry) => sum + entry.amount, 0);

    return {
      month: monthKey,
      label: date.toLocaleDateString(undefined, { month: "short" }),
      amount: roundMoney(amount),
    };
  });

  return {
    expenses: filtered,
    dashboard: {
      month,
      totalEntries: filtered.length,
      totalSpent: roundMoney(totalSpent),
      personalSpent,
      recoverable: roundMoney(totalRecoverable),
      settlementRate,
      settledCount,
      splitFriendsTotal,
      categoryTotals,
      monthlySeries,
    },
    filterOptions: {
      categories: ["food", "travel", "academics", "hostel", "entertainment", "utilities", "other"] as ExpenseCategory[],
      types: ["all", "personal", "split"] as Array<"all" | "personal" | "split">,
    },
  };
}

export async function createExpense(input: {
  userId: string;
  title: string;
  amount: number;
  category?: ExpenseCategory;
  date?: string;
  note?: string;
  splitFriends?: string[];
}) {
  const store = await ensureSeedDataForUser(input.userId);
  const now = nowIso();
  const friends = Array.from(new Set((input.splitFriends ?? []).map((friend) => friend.trim()).filter(Boolean)));
  const splitEnabled = friends.length > 0;

  const totalParticipants = splitEnabled ? friends.length + 1 : 1;
  const splitPerFriend = splitEnabled ? roundMoney(input.amount / totalParticipants) : 0;

  const expense: ExpenseRecord = {
    id: randomUUID(),
    userId: input.userId,
    title: input.title.trim(),
    amount: roundMoney(input.amount),
    category: input.category ?? "other",
    date: input.date ?? todayIsoDate(),
    note: (input.note ?? "").trim(),
    splitEnabled,
    splitFriends: friends,
    splitPerFriend,
    settledFriends: [],
    createdAt: now,
    updatedAt: now,
  };

  store.expenses.push(expense);
  await writeStore(store);
  return expense;
}

export async function updateExpenseSettlement(input: {
  userId: string;
  expenseId: string;
  friendName: string;
  settled: boolean;
}) {
  const store = await ensureSeedDataForUser(input.userId);

  const expense = store.expenses.find((entry) => entry.id === input.expenseId && entry.userId === input.userId);
  if (!expense) {
    return null;
  }

  const friend = expense.splitFriends.find((item) => item.toLowerCase() === input.friendName.trim().toLowerCase());
  if (!friend) {
    return null;
  }

  if (input.settled) {
    if (!expense.settledFriends.includes(friend)) {
      expense.settledFriends.push(friend);
    }
  } else {
    expense.settledFriends = expense.settledFriends.filter((item) => item !== friend);
  }

  expense.updatedAt = nowIso();
  await writeStore(store);
  return expense;
}

export async function deleteExpense(input: { userId: string; expenseId: string }) {
  const store = await ensureSeedDataForUser(input.userId);
  const previousLength = store.expenses.length;
  store.expenses = store.expenses.filter((entry) => !(entry.id === input.expenseId && entry.userId === input.userId));

  if (store.expenses.length === previousLength) {
    return false;
  }

  await writeStore(store);
  return true;
}
