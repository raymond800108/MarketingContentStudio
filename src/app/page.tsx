"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore } from "@/lib/stores/profile-store";

export default function Home() {
  const router = useRouter();
  const activeProfileId = useProfileStore((s) => s.activeProfileId);

  useEffect(() => {
    if (activeProfileId) {
      router.replace("/studio");
    } else {
      router.replace("/onboarding");
    }
  }, [activeProfileId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
