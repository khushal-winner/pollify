import { NextResponse } from "next/server";
import { createAdminClient, createSessionClient } from "@/lib/appwrite-server";
import { setSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    const { account: adminAccount } = createAdminClient();

    // 1. Create anonymous session via admin client to get secret
    const session = await adminAccount.createAnonymousSession();

    if (!session.secret) {
      throw new Error("Failed to retrieve session secret");
    }

    // 2. Retrieve user profile via user session client context
    const { account: sessionAccount } = await createSessionClient(session.secret);
    const user = await sessionAccount.get();

    // 3. Set session cookie
    await setSessionCookie(session.secret);

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("Anonymous login error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create anonymous session" },
      { status: error.code || 500 }
    );
  }
}
