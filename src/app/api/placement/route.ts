import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  buildPlacementDashboard,
  createApplication,
  createPracticeLog,
  listPlacementData,
  type ApplicationStatus,
  updateApplicationStatus,
} from "@/lib/placement-store";

const statusValues = ["applied", "interview", "rejected", "offered"] as const;

const createPracticeSchema = z.object({
  kind: z.literal("practice"),
  topic: z.string().min(2, "Topic is required").max(100),
  date: z.string().date().optional(),
  problemsSolved: z.number().int().min(1).max(50),
  timeSpentMinutes: z.number().int().min(10).max(600),
  difficulty: z.enum(["easy", "medium", "hard"]),
  notes: z.string().max(300).optional(),
});

const createApplicationSchema = z.object({
  kind: z.literal("application"),
  company: z.string().min(2, "Company is required").max(100),
  role: z.string().min(2, "Role is required").max(100),
  status: z.enum(statusValues).optional(),
  appliedOn: z.string().date().optional(),
  location: z.string().max(100).optional(),
  link: z.union([z.string().url("Link must be a valid URL"), z.literal("")]).optional(),
  notes: z.string().max(300).optional(),
});

const updateStatusSchema = z.object({
  kind: z.literal("application-status"),
  applicationId: z.string().min(1),
  status: z.enum(statusValues),
});

const createPayloadSchema = z.discriminatedUnion("kind", [createPracticeSchema, createApplicationSchema]);

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  const company = url.searchParams.get("company") ?? "";
  const rawStatus = url.searchParams.get("status") ?? "";
  const status = statusValues.includes(rawStatus as (typeof statusValues)[number])
    ? (rawStatus as ApplicationStatus)
    : undefined;

  try {
    const { practiceLogs, applications, companies } = await listPlacementData(user.id, {
      query,
      company,
      status,
    });

    const dashboard = buildPlacementDashboard(practiceLogs, applications);

    return NextResponse.json({
      dashboard,
      practiceLogs,
      applications,
      filterOptions: {
        companies,
        statuses: statusValues,
      },
    });
  } catch (error) {
    console.error("Placement GET API error", error);
    return NextResponse.json({ error: "Could not fetch placement data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createPayloadSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    if (parsed.data.kind === "practice") {
      const record = await createPracticeLog({
        userId: user.id,
        topic: parsed.data.topic,
        date: parsed.data.date,
        problemsSolved: parsed.data.problemsSolved,
        timeSpentMinutes: parsed.data.timeSpentMinutes,
        difficulty: parsed.data.difficulty,
        notes: parsed.data.notes,
      });

      return NextResponse.json({ success: true, record }, { status: 201 });
    }

    const application = await createApplication({
      userId: user.id,
      company: parsed.data.company,
      role: parsed.data.role,
      status: parsed.data.status,
      appliedOn: parsed.data.appliedOn,
      location: parsed.data.location,
      link: parsed.data.link,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ success: true, application }, { status: 201 });
  } catch (error) {
    console.error("Placement POST API error", error);
    return NextResponse.json({ error: "Could not save placement item" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateStatusSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const application = await updateApplicationStatus({
      userId: user.id,
      applicationId: parsed.data.applicationId,
      status: parsed.data.status,
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, application });
  } catch (error) {
    console.error("Placement PATCH API error", error);
    return NextResponse.json({ error: "Could not update application status" }, { status: 500 });
  }
}
