export const DB_ID = process.env.APPWRITE_DATABASE_ID || "default";

export const COLLECTIONS = {
    POLLS: "polls",
    OPTIONS: "options",
    VOTES: "votes",
} as const;
