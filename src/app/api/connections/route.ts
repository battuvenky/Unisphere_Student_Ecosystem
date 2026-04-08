import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  listFriendRequests,
  listFriends,
  listSuggestedUsers,
  sendFriendRequest,
} from "@/lib/connections-store";
import { listUsers } from "@/lib/users-store";
import { createNotification } from "@/lib/notifications-store";
import { emitRealtimeToRoom } from "@/lib/realtime";

const sendRequestSchema = z.object({
  targetUserId: z.string().min(1, "Target user is required"),
});

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allUsers = await listUsers();
    const userMap = new Map(
      allUsers.map((record) => [
        record.id,
        {
          id: record.id,
          fullName: record.profile.fullName,
          email: record.email,
          role: record.role,
          department: record.profile.department,
          year: record.profile.year,
          specialization: record.profile.specialization ?? "",
          avatar: initials(record.profile.fullName),
          profileImageUrl: record.profile.profileImageUrl ?? "",
        },
      ])
    );

    const [requestData, friends] = await Promise.all([listFriendRequests(user.id), listFriends(user.id)]);

    const candidateIds = allUsers.map((record) => record.id);
    const suggestedIds = await listSuggestedUsers({ userId: user.id, candidateUserIds: candidateIds });

    const incoming = requestData.incoming.map((request) => ({
      ...request,
      fromUser: userMap.get(request.fromUserId) ?? null,
    }));

    const outgoing = requestData.outgoing.map((request) => ({
      ...request,
      toUser: userMap.get(request.toUserId) ?? null,
    }));

    const friendsWithProfiles = friends.map((friend) => ({
      ...friend,
      profile: userMap.get(friend.friendUserId) ?? null,
    }));

    const suggested = suggestedIds
      .map((id) => userMap.get(id))
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
      .slice(0, 20);

    return NextResponse.json({
      currentUserId: user.id,
      friends: friendsWithProfiles,
      requests: {
        incoming,
        outgoing,
      },
      suggested,
    });
  } catch (error) {
    console.error("Connections GET API error", error);
    return NextResponse.json({ error: "Could not fetch social connections" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = sendRequestSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const result = await sendFriendRequest({
      fromUserId: user.id,
      toUserId: parsed.data.targetUserId,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await createNotification({
      userId: parsed.data.targetUserId,
      type: "friend",
      title: "New friend request",
      message: `${user.profile.fullName} sent you a friend request.`,
      link: "/connections",
      priority: "medium",
    });

    for (const userId of [user.id, parsed.data.targetUserId]) {
      emitRealtimeToRoom(`user:${userId}`, "connections:requests", {
        userIds: [user.id, parsed.data.targetUserId],
        requestId: result.request.id,
      });
    }

    emitRealtimeToRoom(`user:${parsed.data.targetUserId}`, "notifications:changed", {
      userId: parsed.data.targetUserId,
      reason: "friend_request_created",
    });

    return NextResponse.json({ success: true, request: result.request }, { status: 201 });
  } catch (error) {
    console.error("Connections POST API error", error);
    return NextResponse.json({ error: "Could not send friend request" }, { status: 500 });
  }
}
