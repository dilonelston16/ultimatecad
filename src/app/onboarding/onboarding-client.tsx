"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

const steps = ["Start", "Community", "Platforms", "Review"];
const defaultPlatforms = ["ps4", "ps5", "xbox_one", "xbox_series"];

export default function OnboardingClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Montreal");
  const [platforms, setPlatforms] = useState(defaultPlatforms);
  const [joinCode, setJoinCode] = useState("");

  const visibleSteps = mode === "create" ? steps : ["Start", "Join", "Review"];
  const currentTitle = visibleSteps[step];
  const canContinue = useMemo(() => {
    if (step === 0) return true;
    if (mode === "join") return step !== 1 || joinCode.trim().length >= 6;
    if (currentTitle === "Community") return name.trim() && prefix.trim() && slug.trim();
    if (currentTitle === "Platforms") return platforms.length > 0;
    return true;
  }, [currentTitle, joinCode, mode, name, platforms.length, prefix, slug, step]);

  const togglePlatform = (platform: string) => {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((value) => value !== platform)
        : [...current, platform],
    );
  };

  async function finish(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = mode === "create" ? "/api/communities/create" : "/api/communities/join";
    const body = mode === "create"
      ? { name, prefix, slug, timezone, platforms }
      : { joinCode };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "Unable to finish community setup.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="onboarding-page">
      <aside className="onboarding-aside">
        <Link href="/" className="brand">
          <span className="brand-mark">U</span><span>UltimateCAD</span>
        </Link>
        <div className="step-list">
          {visibleSteps.map((label, index) => (
            <div className={`step ${index === step ? "active" : ""} ${index < step ? "done" : ""}`} key={label}>
              <span>{index + 1}</span><b>{label}</b>
            </div>
          ))}
        </div>
      </aside>

      <section className="onboarding-main">
        <form className="form-card" onSubmit={finish}>
          <span className="eyebrow">STEP {step + 1} OF {visibleSteps.length}</span>
          <h1>{currentTitle}</h1>

          {step === 0 && (
            <div className="onboarding-choice-grid">
              <button type="button" className={`onboarding-choice ${mode === "create" ? "selected" : ""}`} onClick={() => setMode("create")}>
                <b>Create a community</b>
                <span>Start a new multi-tenant UltimateCAD workspace and become its Founder.</span>
              </button>
              <button type="button" className={`onboarding-choice ${mode === "join" ? "selected" : ""}`} onClick={() => setMode("join")}>
                <b>Join a community</b>
                <span>Enter a community join code supplied by its ownership team.</span>
              </button>
            </div>
          )}

          {mode === "create" && currentTitle === "Community" && (
            <div className="form-grid">
              <label>Community name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ultimate World Roleplay" required /></label>
              <label>Community prefix<input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="UWRP" maxLength={12} required /></label>
              <label>Community slug<input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="ultimate-world-roleplay" required /></label>
              <label>Timezone<select value={timezone} onChange={(e) => setTimezone(e.target.value)}><option>America/Montreal</option><option>America/New_York</option><option>America/Chicago</option><option>America/Denver</option><option>America/Los_Angeles</option><option>Europe/London</option></select></label>
            </div>
          )}

          {mode === "create" && currentTitle === "Platforms" && (
            <div className="option-grid">
              {[
                ["ps4", "PS4"], ["ps5", "PS5"], ["xbox_one", "Xbox One"], ["xbox_series", "Xbox Series X|S"],
              ].map(([value, label]) => (
                <label key={value}><input type="checkbox" checked={platforms.includes(value)} onChange={() => togglePlatform(value)} />{label}</label>
              ))}
            </div>
          )}

          {mode === "join" && currentTitle === "Join" && (
            <div className="form-grid single-column">
              <label>Community join code<input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="UWRP-8F3K2Q" required /></label>
              <p className="field-help">Join codes are created by community ownership and are separate from department permission keys.</p>
            </div>
          )}

          {currentTitle === "Review" && mode === "create" && (
            <div className="review-box">
              <b>{name || "New UltimateCAD community"}</b>
              <span>{prefix} · {timezone} · {platforms.length} console platform{platforms.length === 1 ? "" : "s"}</span>
              <span>You will be assigned Founder access and receive a unique join code.</span>
            </div>
          )}

          {currentTitle === "Review" && mode === "join" && (
            <div className="review-box">
              <b>Join an existing community</b>
              <span>Code: {joinCode.toUpperCase()}</span>
              <span>Your civilian access will be available immediately. Department access remains permission-based.</span>
            </div>
          )}

          {error && <div className="auth-error" role="alert">{error}</div>}

          <div className="wizard-actions">
            <button type="button" className="button ghost" disabled={step === 0 || loading} onClick={() => setStep((value) => value - 1)}>Back</button>
            {step < visibleSteps.length - 1 ? (
              <button type="button" className="button" disabled={!canContinue || loading} onClick={() => setStep((value) => value + 1)}>Continue</button>
            ) : (
              <button className="button" disabled={loading}>{loading ? "Saving…" : mode === "create" ? "Create community" : "Join community"}</button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
