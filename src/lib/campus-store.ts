import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type CampusIssueCategory = "hostel" | "mess" | "cleanliness" | "electricity" | "water";
export type CampusTicketStatus = "open" | "in_progress" | "resolved";

export type CampusTicket = {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: CampusIssueCategory;
  hostelBlock: string;
  status: CampusTicketStatus;
  createdAt: string;
  updatedAt: string;
};

type MessMeal = {
  breakfast: string[];
  lunch: string[];
  snacks: string[];
  dinner: string[];
};

export type MessMenuDay = {
  day: string;
  meals: MessMeal;
};

type CampusStore = {
  tickets: CampusTicket[];
  messMenu: MessMenuDay[];
};

type TicketFilters = {
  query?: string;
  status?: CampusTicketStatus;
  category?: CampusIssueCategory;
};

const dataDir = path.join(process.cwd(), "data");
const campusFile = path.join(dataDir, "campus.json");

const issueCategories: CampusIssueCategory[] = ["hostel", "mess", "cleanliness", "electricity", "water"];
const issueStatuses: CampusTicketStatus[] = ["open", "in_progress", "resolved"];

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function defaultMessMenu(): MessMenuDay[] {
  return [
    {
      day: "Monday",
      meals: {
        breakfast: ["Poha", "Boiled Eggs", "Banana", "Tea"],
        lunch: ["Rice", "Dal Fry", "Paneer Curry", "Salad"],
        snacks: ["Samosa", "Lemon Tea"],
        dinner: ["Roti", "Rajma", "Jeera Rice", "Curd"],
      },
    },
    {
      day: "Tuesday",
      meals: {
        breakfast: ["Idli", "Sambar", "Coconut Chutney", "Milk"],
        lunch: ["Veg Pulao", "Mixed Veg", "Dal Tadka", "Raita"],
        snacks: ["Sprouts Chaat", "Coffee"],
        dinner: ["Chapati", "Chole", "Rice", "Kheer"],
      },
    },
    {
      day: "Wednesday",
      meals: {
        breakfast: ["Aloo Paratha", "Curd", "Fruit", "Tea"],
        lunch: ["Rice", "Sambar", "Cabbage Stir Fry", "Papad"],
        snacks: ["Bread Roll", "Masala Chai"],
        dinner: ["Roti", "Dal Makhani", "Veg Kofta", "Salad"],
      },
    },
    {
      day: "Thursday",
      meals: {
        breakfast: ["Upma", "Boiled Corn", "Apple", "Milk"],
        lunch: ["Jeera Rice", "Kadhi", "Aloo Gobi", "Salad"],
        snacks: ["Peanut Chikki", "Tea"],
        dinner: ["Roti", "Egg Curry", "Rice", "Curd"],
      },
    },
    {
      day: "Friday",
      meals: {
        breakfast: ["Dosa", "Sambar", "Chutney", "Coffee"],
        lunch: ["Rice", "Dal", "Bhindi Fry", "Salad"],
        snacks: ["Pasta", "Lemon Juice"],
        dinner: ["Roti", "Paneer Butter Masala", "Pulao", "Gulab Jamun"],
      },
    },
    {
      day: "Saturday",
      meals: {
        breakfast: ["Pav Bhaji", "Fruit", "Tea"],
        lunch: ["Veg Biryani", "Raita", "Dal", "Salad"],
        snacks: ["Bhel Puri", "Coffee"],
        dinner: ["Roti", "Mix Dal", "Mushroom Masala", "Curd"],
      },
    },
    {
      day: "Sunday",
      meals: {
        breakfast: ["Chole Bhature", "Fruit", "Lassi"],
        lunch: ["Special Thali", "Rice", "Dal", "Sweet"],
        snacks: ["Cutlet", "Tea"],
        dinner: ["Roti", "Veg Handi", "Jeera Rice", "Ice Cream"],
      },
    },
  ];
}

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(campusFile, "utf8");
  } catch {
    const initial: CampusStore = {
      tickets: [],
      messMenu: defaultMessMenu(),
    };
    await writeFile(campusFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<CampusStore> {
  await ensureStoreFile();
  const raw = await readFile(campusFile, "utf8");
  const parsed = JSON.parse(raw) as Partial<CampusStore>;

  return {
    tickets: parsed.tickets ?? [],
    messMenu: parsed.messMenu && parsed.messMenu.length > 0 ? parsed.messMenu : defaultMessMenu(),
  };
}

async function writeStore(store: CampusStore) {
  await writeFile(campusFile, JSON.stringify(store, null, 2), "utf8");
}

async function ensureSeedTicketsForUser(userId: string): Promise<CampusStore> {
  const store = await readStore();

  const hasUserTickets = store.tickets.some((ticket) => ticket.userId === userId);
  if (hasUserTickets) {
    return store;
  }

  const now = Date.now();
  const templates: Array<Pick<CampusTicket, "title" | "description" | "category" | "hostelBlock" | "status">> = [
    {
      title: "Water leakage near washroom",
      description: "Continuous leak in 2nd floor corridor near Room 214. Floor is slippery.",
      category: "water",
      hostelBlock: "Block B",
      status: "open",
    },
    {
      title: "Mess dinner quality feedback",
      description: "Food served cold during dinner. Please review serving schedule.",
      category: "mess",
      hostelBlock: "Central Mess",
      status: "in_progress",
    },
    {
      title: "Tube light not working",
      description: "Common room tube light flickers and switches off frequently.",
      category: "electricity",
      hostelBlock: "Block A",
      status: "resolved",
    },
  ];

  templates.forEach((template, index) => {
    const createdAt = new Date(now - (index + 2) * 86_400_000).toISOString();

    store.tickets.push({
      id: randomUUID(),
      userId,
      title: template.title,
      description: template.description,
      category: template.category,
      hostelBlock: template.hostelBlock,
      status: template.status,
      createdAt,
      updatedAt: createdAt,
    });
  });

  await writeStore(store);
  return store;
}

export async function listCampusData(userId: string, filters?: TicketFilters) {
  const store = await ensureSeedTicketsForUser(userId);
  const query = normalizeText(filters?.query);

  const tickets = store.tickets
    .filter((ticket) => ticket.userId === userId)
    .filter((ticket) => {
      const queryMatch =
        !query ||
        ticket.title.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query) ||
        ticket.hostelBlock.toLowerCase().includes(query);
      const statusMatch = !filters?.status || ticket.status === filters.status;
      const categoryMatch = !filters?.category || ticket.category === filters.category;
      return queryMatch && statusMatch && categoryMatch;
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  const userTickets = store.tickets.filter((ticket) => ticket.userId === userId);
  const statusCounts = {
    open: userTickets.filter((ticket) => ticket.status === "open").length,
    in_progress: userTickets.filter((ticket) => ticket.status === "in_progress").length,
    resolved: userTickets.filter((ticket) => ticket.status === "resolved").length,
  };

  return {
    tickets,
    messMenu: store.messMenu,
    dashboard: {
      total: userTickets.length,
      ...statusCounts,
      resolutionRate: userTickets.length > 0 ? Math.round((statusCounts.resolved / userTickets.length) * 100) : 0,
    },
    filterOptions: {
      categories: issueCategories,
      statuses: issueStatuses,
    },
  };
}

export async function createCampusTicket(input: {
  userId: string;
  title: string;
  description: string;
  category: CampusIssueCategory;
  hostelBlock?: string;
}) {
  const store = await ensureSeedTicketsForUser(input.userId);
  const now = nowIso();

  const ticket: CampusTicket = {
    id: randomUUID(),
    userId: input.userId,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    hostelBlock: input.hostelBlock?.trim() || "General",
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  store.tickets.push(ticket);
  await writeStore(store);
  return ticket;
}

export async function updateCampusTicketStatus(input: {
  userId: string;
  ticketId: string;
  status: CampusTicketStatus;
}) {
  const store = await ensureSeedTicketsForUser(input.userId);

  const ticket = store.tickets.find((item) => item.id === input.ticketId && item.userId === input.userId);
  if (!ticket) {
    return null;
  }

  ticket.status = input.status;
  ticket.updatedAt = nowIso();

  await writeStore(store);
  return ticket;
}
