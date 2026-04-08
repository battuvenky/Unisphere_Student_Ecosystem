import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { connectMongoose } from "@/lib/mongoose";
import { UserModel } from "@/lib/models/user";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectMongoose();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "12"), 1), 50);

    const filters: Array<Record<string, unknown>> = [{ appId: { $ne: currentUser.id } }];

    if (q.length > 0) {
      const safePattern = escapeRegex(q);
      filters.push({
        $or: [
          { name: { $regex: safePattern, $options: "i" } },
          { department: { $regex: safePattern, $options: "i" } },
        ],
      });
    }

    const users = await UserModel.find({ $and: filters })
      .sort({ name: 1 })
      .limit(limit)
      .select({
        appId: 1,
        name: 1,
        email: 1,
        role: 1,
        department: 1,
        year: 1,
        specialization: 1,
        profileImage: 1,
      })
      .lean<Array<Record<string, unknown>>>();

    return NextResponse.json({
      users: users.map((item) => {
        const fullName = String(item.name ?? "").trim();
        return {
          id: String(item.appId),
          fullName,
          email: String(item.email ?? ""),
          role: item.role === "admin" ? "admin" : "student",
          department: String(item.department ?? ""),
          year: String(item.year ?? ""),
          specialization: String(item.specialization ?? ""),
          avatar: initials(fullName || "User"),
          profileImageUrl: String(item.profileImage ?? ""),
        };
      }),
    });
  } catch (error) {
    console.error("Users search API error", error);
    return NextResponse.json({ error: "Could not search users" }, { status: 500 });
  }
}