import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const clientId = session.clientId!;

  const { createId } = await import("@paralleldrive/cuid2");
  const state = createId();

  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", `${state}:${clientId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });

  const appUrl = new URL(request.url).origin;
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  `${appUrl}/api/google/oauth/callback`,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/adwords",
    access_type:   "offline",
    prompt:        "consent",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
