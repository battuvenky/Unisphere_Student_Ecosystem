import { getCurrentUser } from "@/lib/auth/server";
import { listNotes } from "@/lib/notes-store";
import { buildPlacementDashboard, listPlacementData } from "@/lib/placement-store";
import { listQuestions } from "@/lib/doubts-store";
import { listResources } from "@/lib/resources-store";
import { listTasks } from "@/lib/tasks-store";

type DashboardStats = {
  stats: {
    tasksCompleted: number;
    tasksTotal: number;
    dsaProgress: number;
    resourcesAccessed: number;
  };
  recentActivity: {
    id: string;
    type: "task" | "resource" | "doubt" | "achievement";
    title: string;
    description: string;
    timestamp: string;
    icon: string;
  }[];
};

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const [tasksData, placementData, notesData, questionsData, resourcesData] = await Promise.all([
      listTasks(user.id),
      listPlacementData(user.id),
      listNotes(user.id),
      listQuestions({ sort: "new" }),
      listResources(),
    ]);

    const placementDashboard = buildPlacementDashboard(placementData.practiceLogs, placementData.applications);
    const tasksCompleted = tasksData.dashboard.completed;
    const tasksTotal = tasksData.dashboard.total;
    const resourcesAccessed = resourcesData.reduce((sum, resource) => sum + resource.downloads, 0);

    const recentActivity = [
      ...tasksData.tasks
        .filter((task) => task.status === "done" && task.completedAt)
        .slice(0, 2)
        .map((task) => ({
          id: `task-${task.id}`,
          type: "task" as const,
          title: `Completed: ${task.title}`,
          description: `${task.course} task marked complete`,
          timestamp: task.completedAt ?? task.updatedAt,
          icon: "check",
        })),
      ...notesData.notes.slice(0, 1).map((note) => ({
        id: `note-${note.id}`,
        type: "achievement" as const,
        title: `Updated Note: ${note.title}`,
        description: `${note.category} note refined with tagged insights`,
        timestamp: note.updatedAt,
        icon: "note",
      })),
      ...placementData.practiceLogs.slice(0, 1).map((log) => ({
        id: `practice-${log.id}`,
        type: "achievement" as const,
        title: `DSA Practice: ${log.topic}`,
        description: `${log.problemsSolved} problems solved in ${log.timeSpentMinutes} minutes`,
        timestamp: log.createdAt,
        icon: "target",
      })),
      ...questionsData.slice(0, 1).map((question) => ({
        id: `doubt-${question.id}`,
        type: "doubt" as const,
        title: question.title,
        description: `${question.answersCount} answers and ${question.votes.score} score`,
        timestamp: question.lastActivityAt,
        icon: "chat",
      })),
      ...resourcesData.slice(0, 1).map((resource) => ({
        id: `resource-${resource.id}`,
        type: "resource" as const,
        title: resource.title,
        description: `${resource.subject} resource with ${resource.downloads} downloads`,
        timestamp: resource.createdAt,
        icon: "file",
      })),
    ]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 6);

    const stats: DashboardStats = {
      stats: {
        tasksCompleted,
        tasksTotal,
        dsaProgress: placementDashboard.dsaProgress,
        resourcesAccessed,
      },
      recentActivity,
    };

    return Response.json(stats, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=90",
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return Response.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
