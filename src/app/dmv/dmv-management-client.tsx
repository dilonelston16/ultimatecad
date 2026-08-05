"use client";

import {
  Ban,
  CheckCircle2,
  CircleMinus,
  CirclePlus,
  RefreshCcw,
  ShieldOff,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  applications: any[];
  licenses: any[];
};

export default function DmvManagementClient({
  applications,
  licenses,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState(1);

  async function finalize(applicationId: string, decision: "approve" | "deny") {
    setBusy(applicationId + decision);
    setMessage("");

    const response = await fetch("/api/dmv/applications/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, decision, notes: reason }),
    });
    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error ?? "Application action failed.");
      return;
    }

    setMessage(decision === "approve" ? "License issued." : "Application denied.");
    setReason("");
    router.refresh();
  }

  async function licenseAction(licenseId: string, action: string) {
    setBusy(licenseId + action);
    setMessage("");

    const response = await fetch("/api/dmv/licenses/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        licenseId,
        action,
        reason,
        points,
      }),
    });
    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error ?? "License action failed.");
      return;
    }

    setMessage("License updated successfully.");
    setReason("");
    router.refresh();
  }

  return (
    <div className="dmv-admin-stack">
      {message && <div className="status-banner">{message}</div>}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Decision queue</span>
            <h2>Ready for review</h2>
            <p>Only applications with all required tests completed appear here.</p>
          </div>
        </div>

        <div className="dmv-admin-controls">
          <label>
            DMV notes / reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Required for denials, suspensions and revocations."
            />
          </label>
        </div>

        <div className="dmv-record-list">
          {applications.length ? (
            applications.map((application) => {
              const character = Array.isArray(application.character)
                ? application.character[0]
                : application.character;
              const type = Array.isArray(application.license_type)
                ? application.license_type[0]
                : application.license_type;

              return (
                <article key={application.id}>
                  <div>
                    <b>{character?.first_name} {character?.last_name}</b>
                    <span>{character?.state_id}</span>
                    <span>{type?.name}</span>
                    <code>{application.application_number}</code>
                  </div>
                  <div className="dmv-action-row">
                    <button
                      className="button compact"
                      disabled={busy === application.id + "approve"}
                      onClick={() => finalize(application.id, "approve")}
                    >
                      <CheckCircle2 size={16} /> Approve & issue
                    </button>
                    <button
                      className="button compact danger"
                      disabled={busy === application.id + "deny"}
                      onClick={() => finalize(application.id, "deny")}
                    >
                      <XCircle size={16} /> Deny
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">No applications are ready for review.</div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Issued credentials</span>
            <h2>License management</h2>
            <p>Suspend, revoke, reinstate, renew or adjust driver points.</p>
          </div>
        </div>

        <div className="point-control">
          <label>
            Point adjustment
            <input
              type="number"
              min={1}
              value={points}
              onChange={(event) => setPoints(Math.max(1, Number(event.target.value)))}
            />
          </label>
        </div>

        <div className="dmv-record-list license-management-list">
          {licenses.length ? (
            licenses.map((license) => {
              const character = Array.isArray(license.character)
                ? license.character[0]
                : license.character;
              const type = Array.isArray(license.license_type)
                ? license.license_type[0]
                : license.license_type;

              return (
                <article key={license.id}>
                  <div className="license-management-copy">
                    <div>
                      <b>{character?.first_name} {character?.last_name}</b>
                      <span>{type?.name}</span>
                    </div>
                    <code>{license.license_number}</code>
                    <span className={`status-pill ${license.status}`}>
                      {license.status}
                    </span>
                    <span>{license.points ?? 0} points</span>
                  </div>

                  <div className="dmv-action-grid">
                    <button onClick={() => licenseAction(license.id, "suspend")}>
                      <Ban size={15} /> Suspend
                    </button>
                    <button onClick={() => licenseAction(license.id, "revoke")}>
                      <ShieldOff size={15} /> Revoke
                    </button>
                    <button onClick={() => licenseAction(license.id, "reinstate")}>
                      <ShieldCheck size={15} /> Reinstate
                    </button>
                    <button onClick={() => licenseAction(license.id, "renew")}>
                      <RefreshCcw size={15} /> Renew
                    </button>
                    <button onClick={() => licenseAction(license.id, "add_points")}>
                      <CirclePlus size={15} /> Add points
                    </button>
                    <button onClick={() => licenseAction(license.id, "remove_points")}>
                      <CircleMinus size={15} /> Remove points
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">No licenses have been issued.</div>
          )}
        </div>
      </section>
    </div>
  );
}
