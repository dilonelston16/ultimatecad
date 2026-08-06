"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function WrittenTestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Written license test route failed:", error);
  }, [error]);

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 24,
      background: "#06111f",
      color: "#f5f8fc",
    }}>
      <section style={{
        width: "min(620px, 100%)",
        padding: 32,
        border: "1px solid #71343e",
        borderRadius: 18,
        background: "#111a2b",
        textAlign: "center",
      }}>
        <AlertTriangle size={48} style={{ color: "#ff8392", marginBottom: 14 }} />
        <h1>Written test could not be opened</h1>
        <p style={{ color: "#91a6bf", lineHeight: 1.6 }}>
          {error.message || "UltimateCAD encountered an unexpected error while loading this test."}
        </p>
        {error.digest ? <code>Error reference: {error.digest}</code> : null}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 22,
        }}>
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 14px",
              border: "1px solid #2775c9",
              borderRadius: 9,
              background: "#176dcc",
              color: "white",
            }}
          >
            <RefreshCcw size={16} /> Try again
          </button>
          <Link href="/licenses" style={{
            padding: "10px 14px",
            border: "1px solid #294567",
            borderRadius: 9,
            color: "#dcecff",
            textDecoration: "none",
          }}>
            Return to licenses
          </Link>
        </div>
      </section>
    </main>
  );
}
