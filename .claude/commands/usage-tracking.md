Implement an API usage tracking and cost dashboard system for this project using the pattern documented in `docs/skill-usage-tracking.md`.

Read `docs/skill-usage-tracking.md` first, then adapt it to this project:

1. Define the project's API actions and estimated costs in a `PRICE_TABLE`
2. Create the `useUsageTracking` React hook with localStorage fallback + Redis persistence
3. Create the `/api/usage` route (GET/POST/DELETE with admin multi-user scope)
4. Create a credit system with per-action costs and plan tiers
5. Create a `requireAuth` middleware that checks session + deducts credits before API calls
6. Create a `UsagePanel` dashboard component with: stat cards, 7-day cost chart, service/action breakdowns, paginated activity log, admin controls
7. Add i18n support for all UI strings

Ask the user which API actions/services they need before starting implementation.
