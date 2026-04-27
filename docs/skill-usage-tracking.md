# Skill: API Usage Tracking & Cost Dashboard

A reusable pattern for tracking per-user API consumption, estimating costs, managing credits, and displaying a real-time usage dashboard with admin controls.

---

## Architecture Overview

```
Client (React)                    Server (Next.js API Routes)
┌──────────────┐                  ┌──────────────────┐
│ useUsageTracking hook │ ──POST──▶ │ /api/usage (POST) │──▶ Redis (Upstash KV)
│  • optimistic update  │          │  • append entry   │
│  • localStorage cache │          │  • per-user keys  │
│                       │ ──GET───▶ │ /api/usage (GET)  │──▶ Redis
│  • logUsage()         │          │  • scope: self/all │
│  • clearUsage()       │          │  • admin: any user │
│  • summary            │ ──DEL───▶ │ /api/usage (DEL)  │──▶ Redis
└──────────────┘                  └──────────────────┘
        │
        ▼
┌──────────────┐
│ UsagePanel   │  Dashboard UI: stat cards, charts, activity log
│ (React)      │  Bilingual (EN/ZH), admin multi-user view
└──────────────┘
```

**Dual storage**: Optimistic client-side localStorage + server-side Redis. If Redis is unavailable, degrades to local-only.

---

## Components & Files

### 1. `src/lib/usage.ts` — Client-side hook & types

**Types:**
```ts
type ApiService = "fal" | "kie" | "meshy" | "openai";  // your AI service providers
type ApiAction = "camera-generate" | "inpaint" | "image-generate" | "video-generate" | ...;

interface UsageEntry {
  id: string;           // crypto.randomUUID()
  timestamp: number;    // Date.now()
  service: ApiService;
  action: ApiAction;
  model?: string;       // e.g. "gpt-4o", "kling-2.6"
  costUsd: number;      // estimated cost
  tokensIn?: number;    // for LLM calls
  tokensOut?: number;
  status: "success" | "error";
  detail?: string;      // free-form context
  userEmail?: string;   // stamped server-side
}

interface UsageSummary {
  totalCalls: number;
  totalCostUsd: number;
  totalTokensIn: number;
  totalTokensOut: number;
  byService: Record<ApiService, { calls: number; costUsd: number }>;
  byAction: Record<string, { calls: number; costUsd: number }>;
  last30Days: UsageEntry[];
}
```

**Price table** — fixed estimated cost per action:
```ts
const PRICE_TABLE: Record<ApiAction, { service: ApiService; model: string; costUsd: number }> = {
  "camera-generate": { service: "fal", model: "qwen-edit", costUsd: 0.15 },
  "video-generate":  { service: "kie", model: "kling-2.6", costUsd: 1.50 },
  // ... one entry per action
};
```

**Hook — `useUsageTracking(userEmail, viewMode)`:**
- `viewMode`: `"self"` (default) | `"all"` (admin) | specific email (admin)
- Returns: `{ entries, logUsage, clearUsage, summary, kvAvailable, refreshFromServer }`
- `logUsage(action, opts?)` — creates entry, optimistically updates state, saves to localStorage, fires POST to server
- `clearUsage()` — clears local + server entries
- `refreshFromServer()` — manual refetch from Redis

**localStorage fallback:**
- Key format: `ce-usage:{email}` or `ce-usage:anon`
- Max 500 entries stored locally
- Serves as cache and offline fallback

### 2. `src/lib/credits.ts` — Credit system

```ts
const ACTION_CREDITS: Record<ApiAction, number> = {
  "camera-generate": 1,
  "video-generate": 10,
  "upload": 0,           // free actions
  // ...
};

const PLAN_CREDITS: Record<string, number> = {
  free: 100,
  starter: 80,
  pro: 200,
  business: 600,
};
```

### 3. `src/lib/withAuth.ts` — Auth + credit gate middleware

```ts
async function requireAuth(action?: ApiAction) {
  // 1. Check session (cookie-based)
  // 2. Load user profile
  // 3. Admin bypass (unlimited credits)
  // 4. Check credits >= cost, deduct if enough
  // Returns { user } or { error: NextResponse }
}
```

Usage in API routes:
```ts
export async function POST(req: NextRequest) {
  const authResult = await requireAuth("image-generate");
  if (authResult.error) return authResult.error;
  // proceed with generation...
}
```

### 4. `src/app/api/usage/route.ts` — Server API (Upstash Redis)

**Redis key structure:**
- Per-user: `ce:usage:user:{sanitized_email}` (email dots/@ replaced)
- Max 1000 entries per user (LPUSH + LTRIM)

**Endpoints:**

| Method | Query | Who | Description |
|--------|-------|-----|-------------|
| GET | (none) | Any user | Own entries |
| GET | `?scope=all` | Admin | All users aggregated |
| GET | `?scope=user&email=x` | Admin | Specific user's entries |
| GET | `?scope=list-users` | Admin | List all users with entry counts |
| POST | (none) | Any user | Append entry (auto-stamps userEmail) |
| POST | `?action=migrate-legacy` | Admin | Migrate legacy entries to user |
| DELETE | (none) | Any user | Clear own entries |
| DELETE | `?scope=all` | Admin | Clear all users |
| DELETE | `?scope=user&email=x` | Admin | Clear specific user |

**Key implementation detail:** Entries are stored as JSON strings in Redis lists. The API parses them on read. User email is derived from the session cookie, not from the request body (prevents spoofing).

### 5. `src/components/UsagePanel.tsx` — Dashboard UI

**Sections:**
1. **Storage status badge** — "Cloud synced" vs "Local storage only"
2. **Admin controls** (admin only) — user selector dropdown, refresh, clear all
3. **Stat cards** — Total cost, Total calls, Tokens (in/out), Success rate %
4. **7-day cost chart** — Bar graph with daily cost + call count
5. **Service breakdown** — Cards per service (fal, kie, openai, meshy) with call counts and costs
6. **By-user breakdown** (admin "all" view) — Stacked bar chart per user
7. **By-action breakdown** — Sorted list with proportional bar graphs
8. **Activity log** — Paginated list (20 initial, +30 per load), shows: action label, service, cost, relative time, success/error icon, user email (admin)

**i18n:** All labels have EN + ZH translations via `useI18n()` hook.

---

## How to Integrate Into a New Project

### Step 1: Define your actions & pricing

```ts
// Customize these for your project
type ApiAction = "chat" | "image-gen" | "embedding" | "search" | ...;

const PRICE_TABLE = {
  "chat": { service: "openai", model: "gpt-4o", costUsd: 0.03 },
  "image-gen": { service: "replicate", model: "flux", costUsd: 0.10 },
  // ...
};
```

### Step 2: Set up Redis

- Create an Upstash Redis database
- Add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to env vars
- Or use `@vercel/kv` if on Vercel

### Step 3: Log usage from your API routes

```ts
// In your page/component that calls APIs:
const { logUsage } = useUsageTracking(userEmail);

// After each API call:
logUsage("chat", { status: "success", tokensIn: 150, tokensOut: 80 });
logUsage("image-gen", { status: "error", detail: "NSFW filter triggered" });
```

### Step 4: Add the dashboard

```tsx
<UsagePanel
  entries={entries}
  summary={summary}
  kvAvailable={kvAvailable}
  onClear={clearUsage}
  onRefresh={refreshFromServer}
  userEmail={userEmail}
  isAdmin={isAdmin}
/>
```

### Step 5: Gate API routes with credits

```ts
// In each API route:
const authResult = await requireAuth("chat");
if (authResult.error) return authResult.error;
```

---

## Key Design Decisions

1. **Fixed pricing, not metered** — Each action has a flat estimated cost. Simpler than tracking actual API billing. Update `PRICE_TABLE` when prices change.

2. **Optimistic + fire-and-forget** — UI updates immediately, server persist is async. If server fails, localStorage has the data. No blocking the user.

3. **Per-user Redis keys** — Not one big list. Scales to many users, allows efficient per-user queries and cleanup.

4. **Admin hardcoded** — Admin email(s) are hardcoded in `withAuth.ts`. For a multi-tenant SaaS, replace with a role field in the user profile.

5. **Credits as a separate layer** — Credits are a gamification/billing abstraction on top of raw USD costs. Users see credits; admins see USD costs. Credits deducted at the API gate before the call happens.

6. **Bilingual UI** — All strings go through an i18n layer. Add more languages by extending the translation dictionary.

---

## Dependencies

- **Upstash Redis** (or `@vercel/kv`) — server-side persistence
- **React 18+** — hooks, context
- **Next.js App Router** — API routes, middleware
- **lucide-react** — icons for dashboard
- **Cookie-based auth** — session management (your own or NextAuth)
