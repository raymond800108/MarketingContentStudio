import { NextRequest, NextResponse } from "next/server";
import { getSession, getUserProfile } from "@/lib/auth";
import { getRedis } from "@/lib/redis";
import type { UsageEntry } from "@/lib/usage";

function sanitizeEmail(email: string): string {
  return email.replace(/\./g, "_").replace(/@/g, "__at__");
}

function redisKey(email: string): string {
  return `ce:usage:user:${sanitizeEmail(email)}`;
}

/* ------------------------------------------------------------------ */
/*  GET /api/usage                                                     */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const profile = await getUserProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Redis not available" }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope");

  // --- Admin: list users with summaries ---
  if (scope === "list-users") {
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const keys = await redis.keys("ce:usage:user:*");
    const results: {
      email: string;
      count: number;
      totalCostUsd: number;
      totalTokens: number;
      successCalls: number;
      errorCalls: number;
    }[] = [];
    for (const key of keys) {
      const raw = await redis.lrange(key as string, 0, 999);
      let totalCostUsd = 0;
      let totalTokens = 0;
      let successCalls = 0;
      let errorCalls = 0;
      for (const item of raw) {
        const entry = typeof item === "string" ? JSON.parse(item) : item;
        totalCostUsd += entry.costUsd ?? 0;
        totalTokens += (entry.tokensIn ?? 0) + (entry.tokensOut ?? 0);
        if (entry.status === "success") successCalls++;
        else errorCalls++;
      }
      const sanitized = (key as string).replace("ce:usage:user:", "");
      const email = sanitized.replace(/__at__/g, "@").replace(/_/g, ".");
      results.push({ email, count: raw.length, totalCostUsd, totalTokens, successCalls, errorCalls });
    }
    results.sort((a, b) => b.totalCostUsd - a.totalCostUsd);
    return NextResponse.json(results);
  }

  // --- Admin: all entries ---
  if (scope === "all") {
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const keys = await redis.keys("ce:usage:user:*");
    const allEntries: UsageEntry[] = [];
    for (const key of keys) {
      const raw = await redis.lrange(key as string, 0, 999);
      for (const item of raw) {
        const entry = typeof item === "string" ? JSON.parse(item) : item;
        allEntries.push(entry as UsageEntry);
      }
    }
    allEntries.sort((a, b) => b.timestamp - a.timestamp);
    return NextResponse.json(allEntries);
  }

  // --- Admin: specific user ---
  if (scope === "user") {
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const targetEmail = searchParams.get("email");
    if (!targetEmail) {
      return NextResponse.json({ error: "email param required" }, { status: 400 });
    }
    const raw = await redis.lrange(redisKey(targetEmail), 0, 999);
    const entries = raw.map((item) =>
      typeof item === "string" ? JSON.parse(item) : item
    ) as UsageEntry[];
    return NextResponse.json(entries);
  }

  // --- Own entries ---
  if (!profile.email) {
    return NextResponse.json([]);
  }
  const raw = await redis.lrange(redisKey(profile.email), 0, 999);
  const entries = raw.map((item) =>
    typeof item === "string" ? JSON.parse(item) : item
  ) as UsageEntry[];
  return NextResponse.json(entries);
}

/* ------------------------------------------------------------------ */
/*  POST /api/usage                                                    */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const profile = await getUserProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Redis not available" }, { status: 503 });
  }

  const body = (await request.json()) as UsageEntry;
  // Stamp userEmail from session to prevent spoofing
  body.userEmail = profile.email ?? undefined;

  if (!profile.email) {
    return NextResponse.json({ error: "User email required" }, { status: 400 });
  }

  const key = redisKey(profile.email);
  await redis.lpush(key, JSON.stringify(body));
  await redis.ltrim(key, 0, 999);

  return NextResponse.json({ ok: true });
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/usage                                                  */
/* ------------------------------------------------------------------ */

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const profile = await getUserProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Redis not available" }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope");

  // --- Admin: clear all ---
  if (scope === "all") {
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const keys = await redis.keys("ce:usage:user:*");
    for (const key of keys) {
      await redis.del(key as string);
    }
    return NextResponse.json({ ok: true, deleted: keys.length });
  }

  // --- Admin: clear specific user ---
  if (scope === "user") {
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const targetEmail = searchParams.get("email");
    if (!targetEmail) {
      return NextResponse.json({ error: "email param required" }, { status: 400 });
    }
    await redis.del(redisKey(targetEmail));
    return NextResponse.json({ ok: true });
  }

  // --- Own entries ---
  if (profile.email) {
    await redis.del(redisKey(profile.email));
  }
  return NextResponse.json({ ok: true });
}
