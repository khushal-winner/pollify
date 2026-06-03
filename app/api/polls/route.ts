import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite-server";
import { getSessionUser } from "@/lib/auth";
import { DB_ID, COLLECTIONS } from "@/lib/collections";
import { ID, Query } from "node-appwrite";

export async function GET() {
  try {
    const { databases } = createAdminClient();

    // 1. Fetch polls
    const pollsResponse = await databases.listDocuments({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.POLLS,
      queries: [Query.orderDesc("createdAt"), Query.limit(100)],
    });

    const polls = pollsResponse.documents;

    if (polls.length === 0) {
      return NextResponse.json({ polls: [] });
    }

    const pollIds = polls.map((p: any) => p.$id);

    // 2. Fetch options in bulk
    const optionsResponse = await databases.listDocuments({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.OPTIONS,
      queries: [
        Query.equal("pollId", pollIds),
        Query.limit(1000),
      ],
    });

    const options = optionsResponse.documents;

    // 3. Attach options to polls and check user votes if authenticated
    const user = await getSessionUser();
    const userVotesMap = new Map<string, string>();

    if (user && pollIds.length > 0) {
      try {
        const votesResponse = await databases.listDocuments({
          databaseId: DB_ID,
          collectionId: COLLECTIONS.VOTES,
          queries: [
            Query.equal("userId", user.$id),
            Query.equal("pollId", pollIds),
            Query.limit(100),
          ],
        });
        votesResponse.documents.forEach((vote: any) => {
          userVotesMap.set(vote.pollId, vote.optionId);
        });
      } catch (err) {
        console.error("Failed to fetch user votes:", err);
      }
    }

    const pollsWithOptions = polls.map((poll: any) => {
      const pollOptions = options.filter((opt: any) => opt.pollId === poll.$id);
      return {
        ...poll,
        options: pollOptions,
        userVotedOptionId: userVotesMap.get(poll.$id) || null,
      };
    });

    return NextResponse.json({ polls: pollsWithOptions });
  } catch (error: any) {
    console.error("List polls error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list polls" },
      { status: error.code || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 1. Check Auth
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, expiresAt, options } = await request.json();

    // 2. Validate inputs
    if (!title || !options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: "Title and at least 2 options are required" },
        { status: 400 }
      );
    }

    const { databases } = createAdminClient();

    // 3. Create Poll Document
    const pollId = ID.unique();
    const pollDoc = await databases.createDocument({
      databaseId: DB_ID,
      collectionId: COLLECTIONS.POLLS,
      documentId: pollId,
      data: {
        title,
        description: description || "",
        creatorId: user.$id,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt || "",
        isActive: true,
      },
    });

    // 4. Create Option Documents
    const optionDocs = [];
    for (const optText of options) {
      if (!optText || typeof optText !== "string") continue;
      const optDoc = await databases.createDocument({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.OPTIONS,
        documentId: ID.unique(),
        data: {
          pollId: pollId,
          text: optText,
          votesCount: 0,
        },
      });
      optionDocs.push(optDoc);
    }

    return NextResponse.json({
      poll: {
        ...pollDoc,
        options: optionDocs,
      },
    });
  } catch (error: any) {
    console.error("Create poll error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create poll" },
      { status: error.code || 500 }
    );
  }
}
