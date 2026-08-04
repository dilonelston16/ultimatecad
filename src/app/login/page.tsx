"use client";
import { createBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage(){
  const login = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: `${window.location.origin}/auth/callback` } });
  };
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="brand"><span className="brand-mark">U</span><span>UltimateCAD</span></Link><div><span className="eyebrow">SECURE ACCESS</span><h1>Sign in to your community</h1><p>Use Discord to access your civilian profile and authorized departments.</p></div><button className="button discord" onClick={login}>Continue with Discord</button><small>Discord role and permission-key access can be configured during onboarding.</small></section></main>
}
