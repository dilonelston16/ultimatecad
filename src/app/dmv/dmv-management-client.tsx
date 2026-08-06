"use client";

import {
  Ban,
  CheckCircle2,
  CircleMinus,
  CirclePlus,
  RefreshCcw,
  ShieldCheck,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./dmv-management.module.css";

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

    setMessage(decision === "approve" ? "Licence issued." : "Application denied.");
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
      setMessage(body.error ?? "Licence action failed.");
      return;
    }

    setMessage("Licence updated successfully.");
    setReason("");
    router.refresh();
  }

  return (
    <div className={styles.stack}>
      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.panel}>
        <header className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>Decision queue</span>
            <h2>Ready for review</h2>
            <p>Only applications with all required tests completed appear here.</p>
          </div>
          <div className={styles.count}>{applications.length}</div>
        </header>

        <label className={styles.field}>
          <span>DMV notes or reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Required for denials, suspensions and revocations."
          />
        </label>

        <div className={styles.recordList}>
          {applications.length ? (
            applications.map((application) => {
              const character = Array.isArray(application.character)
                ? application.character[0]
                : application.character;
              const type = Array.isArray(application.license_type)
                ? application.license_type[0]
                : application.license_type;

              return (
                <article className={styles.applicationCard} key={application.id}>
                  <div className={styles.identity}>
                    <div className={styles.avatar}>
                      {(character?.first_name?.[0] ?? "U")}
                      {(character?.last_name?.[0] ?? "C")}
                    </div>
                    <div>
                      <h3>
                        {character?.first_name} {character?.last_name}
                      </h3>
                      <span>{character?.state_id}</span>
                      <strong>{type?.name}</strong>
                      <code>{application.application_number}</code>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      className={styles.primary}
                      disabled={busy === application.id + "approve"}
                      onClick={() => finalize(application.id, "approve")}
                    >
                      <CheckCircle2 size={16} />
                      Approve and issue
                    </button>
                    <button
                      className={styles.danger}
                      disabled={busy === application.id + "deny"}
                      onClick={() => finalize(application.id, "deny")}
                    >
                      <XCircle size={16} />
                      Deny
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className={styles.empty}>
              <CheckCircle2 size={30} />
              <h3>No applications are ready</h3>
              <p>Applications will appear after all required tests are passed.</p>
            </div>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <header className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>Issued credentials</span>
            <h2>Licence management</h2>
            <p>Suspend, revoke, reinstate, renew or adjust driver points.</p>
          </div>
          <div className={styles.count}>{licenses.length}</div>
        </header>

        <div className={styles.toolbar}>
          <label className={styles.smallField}>
            <span>Point adjustment</span>
            <input
              type="number"
              min={1}
              value={points}
              onChange={(event) =>
                setPoints(Math.max(1, Number(event.target.value)))
              }
            />
          </label>
          <p>New licences correctly begin at 0 demerit points.</p>
        </div>

        <div className={styles.licenseGrid}>
          {licenses.length ? (
            licenses.map((license) => {
              const character = Array.isArray(license.character)
                ? license.character[0]
                : license.character;
              const type = Array.isArray(license.license_type)
                ? license.license_type[0]
                : license.license_type;

              return (
                <article className={styles.licenseCard} key={license.id}>
                  <div className={styles.licenseTop}>
                    <div>
                      <span className={styles.typeLabel}>{type?.name}</span>
                      <h3>
                        {character?.first_name} {character?.last_name}
                      </h3>
                      <code>{license.license_number}</code>
                    </div>
                    <span
                      className={`${styles.status} ${
                        styles[license.status] ?? ""
                      }`}
                    >
                      {license.status}
                    </span>
                  </div>

                  <dl className={styles.stats}>
                    <div>
                      <dt>State ID</dt>
                      <dd>{character?.state_id}</dd>
                    </div>
                    <div>
                      <dt>Points</dt>
                      <dd>{license.points ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Issued</dt>
                      <dd>
                        {license.issued_at
                          ? new Date(license.issued_at).toLocaleDateString()
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>
                        {license.expires_at
                          ? new Date(license.expires_at).toLocaleDateString()
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  <div className={styles.actionGrid}>
                    <button onClick={() => licenseAction(license.id, "suspend")}>
                      <Ban size={15} />
                      Suspend
                    </button>
                    <button onClick={() => licenseAction(license.id, "revoke")}>
                      <ShieldOff size={15} />
                      Revoke
                    </button>
                    <button onClick={() => licenseAction(license.id, "reinstate")}>
                      <ShieldCheck size={15} />
                      Reinstate
                    </button>
                    <button onClick={() => licenseAction(license.id, "renew")}>
                      <RefreshCcw size={15} />
                      Renew
                    </button>
                    <button onClick={() => licenseAction(license.id, "add_points")}>
                      <CirclePlus size={15} />
                      Add points
                    </button>
                    <button
                      onClick={() => licenseAction(license.id, "remove_points")}
                    >
                      <CircleMinus size={15} />
                      Remove points
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className={styles.empty}>
              <ShieldCheck size={30} />
              <h3>No licences have been issued</h3>
              <p>Approved applications will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
