import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite-server";
import { DB_ID, COLLECTIONS } from "@/lib/collections";
import { DatabasesIndexType } from "node-appwrite";

export async function POST() {
  try {
    const { databases } = createAdminClient();

    if (!DB_ID) {
      return NextResponse.json(
        { error: "APPWRITE_DATABASE_ID is not configured in .env.local" },
        { status: 500 }
      );
    }

    console.log("Initializing database:", DB_ID);

    // 1. Create Database if it doesn't exist
    try {
      await databases.create({
        databaseId: DB_ID,
        name: "Pollify Database",
        enabled: true,
      });
      console.log("Database created successfully.");
    } catch (error: any) {
      if (error.code === 409) {
        console.log("Database already exists.");
      } else {
        throw error;
      }
    }

    // 2. Setup Polls Collection
    console.log("Setting up Polls collection...");
    try {
      await databases.createCollection({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.POLLS,
        name: "Polls",
        permissions: ['read("any")', 'create("users")', 'update("users")', 'delete("users")'],
      });
      console.log("Polls collection created.");
    } catch (error: any) {
      if (error.code !== 409) throw error;
      console.log("Polls collection already exists.");
    }

    // Create Polls attributes
    const pollAttrs = [
      { key: "title", type: "string", size: 256, required: true },
      { key: "description", type: "string", size: 1000, required: false },
      { key: "creatorId", type: "string", size: 36, required: true },
      { key: "createdAt", type: "string", size: 36, required: true },
      { key: "expiresAt", type: "string", size: 36, required: false },
      { key: "isActive", type: "boolean", required: true, xdefault: true },
    ];

    for (const attr of pollAttrs) {
      try {
        if (attr.type === "string") {
          await databases.createStringAttribute({
            databaseId: DB_ID,
            collectionId: COLLECTIONS.POLLS,
            key: attr.key,
            size: attr.size!,
            required: attr.required,
          });
        } else if (attr.type === "boolean") {
          await databases.createBooleanAttribute({
            databaseId: DB_ID,
            collectionId: COLLECTIONS.POLLS,
            key: attr.key,
            required: attr.required,
            xdefault: attr.xdefault as boolean,
          });
        }
        console.log(`Attribute '${attr.key}' created in Polls.`);
      } catch (error: any) {
        if (error.code !== 409) throw error;
      }
    }

    // 3. Setup Options Collection
    console.log("Setting up Options collection...");
    try {
      await databases.createCollection({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.OPTIONS,
        name: "Options",
        permissions: ['read("any")', 'create("users")', 'update("users")', 'delete("users")'],
      });
      console.log("Options collection created.");
    } catch (error: any) {
      if (error.code !== 409) throw error;
      console.log("Options collection already exists.");
    }

    const optionAttrs = [
      { key: "pollId", type: "string", size: 36, required: true },
      { key: "text", type: "string", size: 256, required: true },
      { key: "votesCount", type: "integer", required: true, xdefault: 0 },
    ];

    for (const attr of optionAttrs) {
      try {
        if (attr.type === "string") {
          await databases.createStringAttribute({
            databaseId: DB_ID,
            collectionId: COLLECTIONS.OPTIONS,
            key: attr.key,
            size: attr.size!,
            required: attr.required,
          });
        } else if (attr.type === "integer") {
          await databases.createIntegerAttribute({
            databaseId: DB_ID,
            collectionId: COLLECTIONS.OPTIONS,
            key: attr.key,
            required: attr.required,
            xdefault: attr.xdefault as number,
          });
        }
        console.log(`Attribute '${attr.key}' created in Options.`);
      } catch (error: any) {
        if (error.code !== 409) throw error;
      }
    }

    // 4. Setup Votes Collection
    console.log("Setting up Votes collection...");
    try {
      await databases.createCollection({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.VOTES,
        name: "Votes",
        permissions: ['read("any")', 'create("users")', 'update("users")', 'delete("users")'],
      });
      console.log("Votes collection created.");
    } catch (error: any) {
      if (error.code !== 409) throw error;
      console.log("Votes collection already exists.");
    }

    const voteAttrs = [
      { key: "pollId", type: "string", size: 36, required: true },
      { key: "optionId", type: "string", size: 36, required: true },
      { key: "userId", type: "string", size: 36, required: true },
    ];

    for (const attr of voteAttrs) {
      try {
        await databases.createStringAttribute({
          databaseId: DB_ID,
          collectionId: COLLECTIONS.VOTES,
          key: attr.key,
          size: attr.size!,
          required: attr.required,
        });
        console.log(`Attribute '${attr.key}' created in Votes.`);
      } catch (error: any) {
        if (error.code !== 409) throw error;
      }
    }

    // 5. Wait for attributes to process before indexing
    console.log("Waiting for attributes to process...");
    await waitForAttributes(databases, DB_ID, COLLECTIONS.POLLS, ["createdAt", "creatorId"]);
    await waitForAttributes(databases, DB_ID, COLLECTIONS.OPTIONS, ["pollId"]);
    await waitForAttributes(databases, DB_ID, COLLECTIONS.VOTES, ["pollId", "userId"]);
    console.log("All attributes are ready.");

    // 6. Create Indexes
    // Polls indexes
    try {
      await databases.createIndex({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.POLLS,
        key: "createdAt_idx",
        type: DatabasesIndexType.Key,
        attributes: ["createdAt"],
      });
      console.log("Index 'createdAt_idx' created in Polls.");
    } catch (error: any) {
      if (error.code !== 409) throw error;
    }

    try {
      await databases.createIndex({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.POLLS,
        key: "creatorId_idx",
        type: DatabasesIndexType.Key,
        attributes: ["creatorId"],
      });
      console.log("Index 'creatorId_idx' created in Polls.");
    } catch (error: any) {
      if (error.code !== 409) throw error;
    }

    // Options indexes
    try {
      await databases.createIndex({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.OPTIONS,
        key: "pollId_idx",
        type: DatabasesIndexType.Key,
        attributes: ["pollId"],
      });
      console.log("Index 'pollId_idx' created in Options.");
    } catch (error: any) {
      if (error.code !== 409) throw error;
    }

    // Votes unique index (prevents user voting more than once on same poll)
    try {
      await databases.createIndex({
        databaseId: DB_ID,
        collectionId: COLLECTIONS.VOTES,
        key: "pollId_userId_idx",
        type: DatabasesIndexType.Unique,
        attributes: ["pollId", "userId"],
      });
      console.log("Unique Index 'pollId_userId_idx' created in Votes.");
    } catch (error: any) {
      if (error.code !== 409) throw error;
    }

    return NextResponse.json({ success: true, message: "Database schema initialized successfully." });
  } catch (error: any) {
    console.error("Initialization failed:", error);
    return NextResponse.json({ error: error.message || "Initialization failed" }, { status: 500 });
  }
}

async function waitForAttributes(databases: any, dbId: string, colId: string, keys: string[]) {
  for (let i = 0; i < 30; i++) {
    const col = await databases.getCollection({ databaseId: dbId, collectionId: colId });
    const allReady = keys.every((key) => {
      const attr = col.attributes.find((a: any) => a.key === key);
      return attr && attr.status === "available";
    });
    if (allReady) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timeout waiting for attributes in collection ${colId}`);
}
