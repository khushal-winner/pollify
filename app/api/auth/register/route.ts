import { NextResponse } from "next/server";
import { createAdminClient, createSessionClient } from "@/lib/appwrite-server";
import { setSessionCookie } from "@/lib/auth";
import { ID } from "node-appwrite";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const { account: adminAccount } = createAdminClient();

    // 1. Create account
    const user = await adminAccount.create(
      ID.unique(),
      email,
      password,
      name || undefined
    );

    // 2. Log user in with admin client to get the session secret
    const session = await adminAccount.createEmailPasswordSession({
      email,
      password,
    });

    if (!session.secret) {
      throw new Error("Failed to retrieve session secret");
    }

    // 3. Set session cookie
    await setSessionCookie(session.secret);

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to register" },
      { status: error.code || 500 }
    );
  }
}
