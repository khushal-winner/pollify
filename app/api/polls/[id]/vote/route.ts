import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite-server";
import { getSessionUser } from "@/lib/auth";
import { DB_ID, COLLECTIONS } from "@/lib/collections";
import { Query } from "node-appwrite";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pollId } = await context.params;

    // 1. Check Auth
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { optionId } = await request.json();
    if (!optionId) {
      return NextResponse.json({ error: "Option ID is required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    // 2. Fetch the poll
    let poll;
    try {
      poll = await databases.getDocument({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.POLLS,
        documentId: pollId,
      });
    } catch (err: any) {
      if (err.code === 404) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 });
      }
      throw err;
    }

    // 3. Validate poll activity and expiration
    if (!poll.isActive) {
      return NextResponse.json({ error: "This poll is no longer active" }, { status: 400 });
    }

    if (poll.expiresAt) {
      const expiry = new Date(poll.expiresAt);
      if (expiry < new Date()) {
        return NextResponse.json({ error: "This poll has expired" }, { status: 400 });
      }
    }

    // 4. Fetch the option
    let option;
    try {
      option = await databases.getDocument({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.OPTIONS,
        documentId: optionId,
      });
    } catch (err: any) {
      if (err.code === 404) {
        return NextResponse.json({ error: "Option not found" }, { status: 404 });
      }
      throw err;
    }

    if (option.pollId !== pollId) {
      return NextResponse.json({ error: "Option does not belong to this poll" }, { status: 400 });
    }

    // 5. Query check for existing vote
    const existingVotes = await databases.listDocuments({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.VOTES,
      queries: [
        Query.equal("pollId", pollId),
        Query.equal("userId", user.$id),
        Query.limit(1),
      ],
    });

    if (existingVotes.total > 0) {
      return NextResponse.json({ error: "You have already voted on this poll" }, { status: 400 });
    }

    // 6. Record vote with deterministic ID to prevent double-voting concurrency race conditions
    const voteDocId = `${pollId}_${user.$id}`;
    try {
      await databases.createDocument({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.VOTES,
        documentId: voteDocId,
        data: {
          pollId,
          optionId,
          userId: user.$id,
        },
      });
    } catch (err: any) {
      if (err.code === 409) {
        return NextResponse.json({ error: "You have already voted on this poll" }, { status: 400 });
      }
      throw err;
    }

    // 7. Increment votes count on the option
    const updatedOption = await databases.updateDocument({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.OPTIONS,
      documentId: optionId,
      data: {
        votesCount: (option.votesCount || 0) + 1,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Vote recorded successfully",
      option: updatedOption,
    });
  } catch (error: any) {
    console.error("Voting error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record vote" },
      { status: error.code || 500 }
    );
  }
}
