export type UserRole = "admin" | "member";

interface AllowlistEntry {
  email: string;
  role: UserRole;
}

interface AllowlistEntryWithExtras extends AllowlistEntry {
  credits?: number;
  /** Blotato accountId bound to this user. Non-admin users can ONLY post to
   *  this account. When present, the social page auto-selects it and hides
   *  any account switcher for this user. */
  blotatoAccountId?: string;
  /** Human-friendly label for the bound Blotato account. */
  blotatoAccountLabel?: string;
}

const HARDCODED_ALLOWLIST: AllowlistEntryWithExtras[] = [
  { email: "raymond800108@gmail.com", role: "admin" },
  {
    email: "luisaschreyer0526@gmail.com",
    role: "member",
    credits: 100,
    blotatoAccountId: "41782",
    blotatoAccountLabel: "innery.lab",
  },
  {
    email: "necksy.de@gmail.com",
    role: "member",
    credits: 100,
    blotatoAccountId: "41768",
    blotatoAccountLabel: "necksy_de",
  },
];

function getAllowlist(): AllowlistEntry[] {
  const envList = process.env.ALLOWED_EMAILS;
  if (envList) {
    // Format: "email1:admin,email2:member,email3" (no role = member)
    return envList
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((entry) => {
        const [email, role] = entry.split(":");
        return { email, role: role === "admin" ? "admin" : "member" } as AllowlistEntry;
      });
  }
  return HARDCODED_ALLOWLIST;
}

export function isEmailAllowed(email: string | null): boolean {
  const allowlist = getAllowlist();
  if (allowlist.length === 0) return true;
  if (!email) return false;
  return allowlist.some((e) => e.email === email.toLowerCase());
}

export function getEmailRole(email: string | null): UserRole {
  if (!email) return "member";
  const allowlist = getAllowlist();
  const entry = allowlist.find((e) => e.email === email.toLowerCase());
  return entry?.role ?? "member";
}

export function getEmailCredits(email: string | null): number | undefined {
  if (!email) return undefined;
  const entry = HARDCODED_ALLOWLIST.find((e) => e.email === email.toLowerCase());
  return entry?.credits;
}

export function getEmailBlotatoAccount(
  email: string | null
): { id: string; label: string } | null {
  if (!email) return null;
  const entry = HARDCODED_ALLOWLIST.find((e) => e.email === email.toLowerCase());
  if (!entry?.blotatoAccountId) return null;
  return {
    id: entry.blotatoAccountId,
    label: entry.blotatoAccountLabel ?? entry.blotatoAccountId,
  };
}
