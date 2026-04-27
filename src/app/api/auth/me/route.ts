import { NextResponse } from "next/server";
import { getSession, getUserProfile } from "@/lib/auth";
import { getEmailBlotatoAccount } from "@/lib/allowlist";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const profile = await getUserProfile(session.userId);
  if (!profile) return NextResponse.json({ user: null });

  const blotatoAccount = getEmailBlotatoAccount(profile.email);

  return NextResponse.json({
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
      provider: profile.provider,
      role: profile.role ?? "member",
      plan: profile.plan,
      credits: profile.credits,
      blotatoAccountId: blotatoAccount?.id ?? null,
      blotatoAccountLabel: blotatoAccount?.label ?? null,
    },
  });
}
