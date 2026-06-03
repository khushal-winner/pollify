import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/appwrite-server";
import { deleteSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    // 1. Get session client and invalidate session on Appwrite
    const { account } = await createSessionClient();
    await account.deleteSession({ sessionId: "current" });
  } catch (error) {
    // Swallow error if session is already invalid
    console.warn("Appwrite logout warning:", error);
  }

  // 2. Clear cookie
  await deleteSessionCookie();

  return NextResponse.json({ success: true });
}
