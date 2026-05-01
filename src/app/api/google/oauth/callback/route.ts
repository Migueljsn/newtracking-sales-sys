import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = new URL(request.url).origin;

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=1`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;

  if (!storedState) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=1`);
  }

  const [expectedState, clientId] = storedState.split(":");

  if (state !== expectedState || !clientId) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=1`);
  }

  cookieStore.delete("google_oauth_state");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${appUrl}/api/google/oauth/callback`,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=1`);
  }

  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=1`);
  }

  await prisma.clientSettings.upsert({
    where:  { clientId },
    create: { clientId, googleRefreshToken: tokens.refresh_token },
    update: { googleRefreshToken: tokens.refresh_token },
  });

  return NextResponse.redirect(`${appUrl}/settings?google_connected=1`);
}
