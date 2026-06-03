import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite-server";
import { getSessionUser } from "@/lib/auth";
import { DB_ID, COLLECTIONS } from "@/lib/collections";
import { Query } from "node-appwrite";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { databases } = createAdminClient();

    // 1. Get poll
    const poll = await databases.getDocument({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.POLLS,
      documentId: id,
    });

    // 2. Get options
    const optionsResponse = await databases.listDocuments({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.OPTIONS,
      queries: [Query.equal("pollId", id), Query.limit(100)],
    });

    return NextResponse.json({
      poll: {
        ...poll,
        options: optionsResponse.documents,
      },
    });
  } catch (error: any) {
    console.error("Get poll error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get poll" },
      { status: error.code || 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases } = createAdminClient();

    // 1. Fetch the poll to verify ownership
    const poll = await databases.getDocument({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.POLLS,
      documentId: id,
    });

    if (poll.creatorId !== user.$id) {
      return NextResponse.json(
        { error: "Forbidden: You are not the creator of this poll" },
        { status: 403 }
      );
    }

    // 2. Delete all options
    const optionsResponse = await databases.listDocuments({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.OPTIONS,
      queries: [Query.equal("pollId", id), Query.limit(100)],
    });

    for (const option of optionsResponse.documents) {
      await databases.deleteDocument({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.OPTIONS,
        documentId: option.$id,
      });
    }

    // 3. Delete all votes
    const votesResponse = await databases.listDocuments({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.VOTES,
      queries: [Query.equal("pollId", id), Query.limit(1000)],
    });

    for (const vote of votesResponse.documents) {
      await databases.deleteDocument({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.VOTES,
        documentId: vote.$id,
      });
    }

    // 4. Delete the poll itself
    await databases.deleteDocument({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.POLLS,
      documentId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Poll and associated data deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete poll error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete poll" },
      { status: error.code || 500 }
    );
  }
}
