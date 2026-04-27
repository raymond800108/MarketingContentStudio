import { NextResponse } from "next/server";
import { getSession, getUserProfile, deductCredits } from "./auth";
import type { UserProfile } from "./auth";
import type { ApiAction } from "./usage";
import { ACTION_CREDITS } from "./credits";

export async function requireAuth(
  action?: ApiAction
): Promise<
  | { user: UserProfile; error?: undefined }
  | { user?: undefined; error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  const user = await getUserProfile(session.userId);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "User profile not found" },
        { status: 401 }
      ),
    };
  }

  if (action) {
    const cost = ACTION_CREDITS[action] ?? 0;
    if (cost > 0) {
      // Admins have unlimited credits
      if (user.role !== "admin") {
        if (user.credits < cost) {
          return {
            error: NextResponse.json(
              {
                error: "Insufficient credits",
                creditsNeeded: cost,
                creditsAvailable: user.credits,
              },
              { status: 403 }
            ),
          };
        }

        const deducted = await deductCredits(session.userId, cost);
        if (!deducted) {
          return {
            error: NextResponse.json(
              { error: "Failed to deduct credits. Please try again." },
              { status: 500 }
            ),
          };
        }
        user.credits -= cost;
      }
    }
  }

  return { user };
}

export function isAdmin(profile: UserProfile): boolean {
  return profile.role === "admin";
}
