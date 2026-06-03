import { NextResponse } from "next/server";
import { createAdminClient, createSessionClient } from "@/lib/appwrite-server";
import { setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const { account: adminAccount } = createAdminClient();

    // 1. Create session via admin client to get secret
    const session = await adminAccount.createEmailPasswordSession({
      email,
      password,
    });

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
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to login" },
      { status: error.code || 500 }
    );
  }
}
