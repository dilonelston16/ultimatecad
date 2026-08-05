"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const errorMessages: Record<string, string> = {
  missing_code: "Discord did not return a valid login code. Please try again.",
  oauth_callback: "UltimateCAD could not finish the Discord sign-in.",
  session: "Your session could not be created. Please sign in again.",
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const errorCode = searchParams.get("error");

  const login = async () => {
    setLoading(true);
    setClientError(null);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "identify email guilds",
      },
    });

    if (error) {
      setClientError(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="brand">
          <span className="brand-mark">U</span>
          <span>UltimateCAD</span>
        </Link>
        <div>
          <span className="eyebrow">SECURE ACCESS</span>
          <h1>Sign in to your community</h1>
          <p>
            Use Discord to access your civilian profile and every department you
            are authorized to use.
          </p>
        </div>
        {(clientError || errorCode) && (
          <div className="auth-error" role="alert">
            {clientError ?? errorMessages[errorCode ?? ""] ?? "Login failed."}
          </div>
        )}
        <button className="button discord" onClick={login} disabled={loading}>
          {loading ? "Opening Discord…" : "Continue with Discord"}
        </button>
        <small>
          Your Discord identity is used for authentication. Department access is
          controlled separately through memberships, roles and permission keys.
        </small>
      </section>
    </main>
  );
}
