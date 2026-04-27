"use client";

/**
 * /magic — the guided "input → magic" flow.
 *
 * Triggered from the landing-page hero CTA after Google sign-in. Receives
 * (productImageUrl, text) from the magic-store, runs /api/magic/run to
 * produce the deterministic inferences (family, archetype, hook, audience,
 * benefit, clipLength), then hands off to /ugc (Video Ads) with everything
 * pre-filled — so the user skips the archetype picker + brief and lands
 * directly on the storyboard step.
 *
 * Stage-named progress bar narrates the magic — silent loading kills wonder.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2, Loader2, Check } from "lucide-react";
import { useT, useTMaybe } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useMagicStore, type MagicStage } from "@/lib/stores/magic-store";
import { useUgcStore } from "@/lib/stores/ugc-store";

const STAGES: { key: MagicStage; labelKey: string; fallback: string }[] = [
  { key: "analyzing", labelKey: "magic.stage.analyzing", fallback: "Recognizing your product" },
  { key: "intent", labelKey: "magic.stage.intent", fallback: "Reading your brief" },
  { key: "archetype", labelKey: "magic.stage.archetype", fallback: "Picking the angle" },
  { key: "hook", labelKey: "magic.stage.hook", fallback: "Choosing the hook" },
  { key: "ready", labelKey: "magic.stage.ready", fallback: "Ready to render" },
];

export default function MagicPage() {
  const router = useRouter();
  const { user, ready: authReady, openLogin } = useAuth();
  const {
    productImageUrl,
    text,
    familyChoice,
    stage,
    errorMsg,
    inference,
    creatorOverrides,
    setStage,
    setError,
    setInference,
  } = useMagicStore();
  const ugcStore = useUgcStore();
  const t = useT();
  const tM = useTMaybe();
  const [started, setStarted] = useState(false);

  // Bounce out if no input — back to LP. Bounce to login if not signed in.
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      openLogin();
      return;
    }
    if (!productImageUrl) {
      router.replace("/");
      return;
    }
  }, [authReady, user, openLogin, productImageUrl, router]);

  // Run the magic pipeline once on mount.
  useEffect(() => {
    if (started || !productImageUrl || !user) return;
    setStarted(true);
    (async () => {
      try {
        setError(null);
        setStage("analyzing");
        // Stage transitions are paced by the orchestration server — we
        // simulate the visual progress by ticking through the stages while
        // the single /api/magic/run call is in flight. Could be SSE later.
        const tickStages = ["analyzing", "intent", "archetype", "hook"] as const;
        let i = 0;
        const tick = setInterval(() => {
          i = Math.min(i + 1, tickStages.length - 1);
          setStage(tickStages[i]);
        }, 1500);

        const r = await fetch("/api/magic/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productImageUrl,
            text,
            familyOverride: familyChoice === "auto" ? undefined : familyChoice,
          }),
        });
        clearInterval(tick);
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || `Magic failed (${r.status})`);
        }
        const data = await r.json();
        const inf = data.inference || {};
        setInference(inf);
        setStage("ready");

        // Pre-fill the UGC store so /ugc can skip directly to the storyboard.
        ugcStore.setProductImageUrl(productImageUrl);
        if (inf.family) ugcStore.setFamily(inf.family);
        if (inf.archetypeId) ugcStore.setArchetypeId(inf.archetypeId);
        if (inf.clipLength) ugcStore.setClipLength(inf.clipLength);
        ugcStore.setInput({
          benefit: inf.benefit || text || "",
          audience: inf.audience || "",
          productNotes: text || "",
        });
        // Forward optional creator overrides (only meaningful for UGC family —
        // Commercial archetypes have no on-camera creator). We pass them
        // unconditionally; downstream the UGC brief route ignores them when
        // family !== "ugc".
        if (creatorOverrides) {
          ugcStore.setCreatorOverrides({
            age: creatorOverrides.age,
            gender: creatorOverrides.gender,
            race: creatorOverrides.race,
            hairColor: creatorOverrides.hairColor,
            eyeColor: creatorOverrides.eyeColor,
          });
        }
        ugcStore.setStep("brief");

        // Brief moment to show "Ready" before handoff (gives the UI a beat).
        setTimeout(() => router.push("/ugc"), 700);
      } catch (e) {
        setStage("error");
        setError(e instanceof Error ? e.message : "Magic flow failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, productImageUrl, user]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="max-w-xl w-full">
        {/* Product preview */}
        {productImageUrl && (
          <div className="mb-10 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageUrl}
              alt=""
              className="w-32 h-32 rounded-2xl object-cover border border-border shadow-lg"
            />
          </div>
        )}

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-3 flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-accent" />
          {tM("magic.title", "Brewing your ad")}
        </h1>
        <p className="text-muted text-center mb-10">
          {tM(
            "magic.sub",
            "Watching the model find the right angle, hook, and shot grammar for your product."
          )}
        </p>

        {/* Stage list */}
        <div className="space-y-3 mb-8">
          {STAGES.map((s, i) => {
            const stageOrder = STAGES.map((x) => x.key);
            const currentIdx = stageOrder.indexOf(stage);
            const stageIdx = i;
            const isDone = currentIdx > stageIdx;
            const isActive = currentIdx === stageIdx;
            const isPending = currentIdx < stageIdx && stage !== "error";
            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isActive
                    ? "border-accent bg-accent/5"
                    : isDone
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-border opacity-50"
                }`}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                  {isDone ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-muted/40" />
                  )}
                </div>
                <span className={`text-sm ${isActive ? "font-medium" : ""}`}>
                  {tM(s.labelKey, s.fallback)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error state */}
        {stage === "error" && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600">
            <p className="font-medium mb-1">
              {tM("magic.error.title", "The magic stumbled.")}
            </p>
            <p className="text-xs opacity-80 mb-3">{errorMsg}</p>
            <button
              onClick={() => router.push("/")}
              className="text-xs underline"
            >
              {tM("magic.error.back", "Back to start")}
            </button>
          </div>
        )}

        {/* Inference reveal (success preview just before handoff) */}
        {stage === "ready" && inference && (
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-5 mb-6">
            <p className="text-xs uppercase tracking-widest text-accent font-semibold mb-3">
              {tM("magic.inference.title", "Your direction")}
            </p>
            <dl className="space-y-2 text-sm">
              {inference.family && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{tM("magic.inf.family", "Style")}</dt>
                  <dd className="font-medium capitalize">{inference.family}</dd>
                </div>
              )}
              {inference.category && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{tM("magic.inf.category", "Category")}</dt>
                  <dd className="font-medium">{inference.category}</dd>
                </div>
              )}
              {inference.audience && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{tM("magic.inf.audience", "Audience")}</dt>
                  <dd className="font-medium text-right">{inference.audience}</dd>
                </div>
              )}
              {inference.hookLine && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{tM("magic.inf.hook", "Hook")}</dt>
                  <dd className="font-medium text-right">&quot;{inference.hookLine}&quot;</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Static helper text */}
        {stage !== "error" && stage !== "ready" && (
          <p className="text-xs text-muted/60 text-center">
            {tM(
              "magic.helper",
              "This usually takes 8–12 seconds. We're picking the angle that converts for your niche."
            )}
          </p>
        )}
      </div>
    </div>
  );
}
