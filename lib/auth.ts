import { cookies } from "next/headers";
import { createSessionClient } from "./appwrite-server";
import { Models } from "node-appwrite";

export async function getSessionUser(): Promise<Models.User<Models.Preferences> | null> {
  try {
    const { account } = await createSessionClient();
    return await account.get();
  } catch (error) {
    console.error("getSessionUser error details:", error);
    return null;
  }
}

export async function setSessionCookie(secret: string) {
  const cookieStore = await cookies();
  cookieStore.set("pollify_session", secret, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("pollify_session");
}
