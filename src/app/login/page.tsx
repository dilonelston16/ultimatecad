import { Suspense } from "react";
import LoginClient from "./login-client";

function LoginFallback() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-busy="true">
        <div className="brand">
          <span className="brand-mark">U</span>
          <span>UltimateCAD</span>
        </div>
        <div>
          <span className="eyebrow">SECURE ACCESS</span>
          <h1>Loading secure sign-in…</h1>
          <p>Preparing your Discord authentication session.</p>
        </div>
        <button className="button discord" disabled>
          Loading…
        </button>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}
