"use client";

import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Shield,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./license-application-panel.module.css";

type Props = {
  characterId: string;
  types: any[];
  applications: any[];
  licenses: any[];
};

export default function LicenseApplicationPanel({
  characterId,
  types,
  applications,
  licenses,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function apply(typeId: string) {
    setBusy(typeId);
    setMessage("");

    const response = await fetch("/api/licenses/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId, licenseTypeId: typeId }),
    });

    const body = await response.json();
    setBusy(null);

    if (!response.ok) {
      setMessage(body.error || "Application failed.");
      return;
    }

    setMessage("Application submitted. Your required tests are now available.");
    router.refresh();
  }

  const hasOpen = (typeId: string) =>
    applications.some(
      (application) =>
        application.license_type_id === typeId &&
        ["pending", "submitted", "testing", "ready_for_review", "under_review"].includes(
          application.status
        )
    );

  const hasValid = (typeId: string) =>
    licenses.some(
      (license) =>
        license.license_type_id === typeId && license.status === "valid"
    );

  return (
    <div className={styles.layout}>
      <section className={styles.panel}>
        <header className={styles.heading}>
          <div>
            <span>Available credentials</span>
            <h2>Apply for a licence</h2>
            <p>
              Apply, complete the written exam, then finish any required practical
              evaluation.
            </p>
          </div>
        </header>

        {message && <div className={styles.message}>{message}</div>}

        <div className={styles.typeList}>
          {types.map((type) => (
            <article key={type.id}>
              <div className={styles.icon}>
                <Shield size={22} />
              </div>

              <div className={styles.typeCopy}>
                <div className={styles.typeTitle}>
                  <b>{type.name}</b>
                  <code>{type.code}</code>
                </div>
                <p>{type.description}</p>
                <div className={styles.requirements}>
                  <span>
                    {type.requires_written_test
                      ? "Online written test"
                      : "No written test"}
                  </span>
                  <span>
                    {type.requires_practical_test
                      ? "Staff practical test"
                      : "No practical test"}
                  </span>
                  <span>{type.validity_months} months</span>
                  <span>${Number(type.application_fee).toLocaleString()}</span>
                </div>
              </div>

              <button
                className={styles.apply}
                disabled={
                  busy === type.id || hasOpen(type.id) || hasValid(type.id)
                }
                onClick={() => apply(type.id)}
              >
                {hasValid(type.id)
                  ? "Already issued"
                  : hasOpen(type.id)
                    ? "In progress"
                    : busy === type.id
                      ? "Submitting…"
                      : "Apply"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.sideStack}>
        <section className={styles.panel}>
          <header className={styles.heading}>
            <div>
              <span>Issued credentials</span>
              <h2>My licences</h2>
            </div>
          </header>

          <div className={styles.issuedList}>
            {licenses.length ? (
              licenses.map((license) => {
                const type = Array.isArray(license.license_type)
                  ? license.license_type[0]
                  : license.license_type;

                return (
                  <article key={license.id}>
                    <div className={styles.issuedTop}>
                      <BadgeCheck size={19} />
                      <div>
                        <b>{type?.name}</b>
                        <code>{license.license_number}</code>
                      </div>
                      <span className={styles[license.status] ?? styles.status}>
                        {license.status}
                      </span>
                    </div>

                    <dl>
                      <div>
                        <dt>Issued</dt>
                        <dd>{new Date(license.issued_at).toLocaleDateString()}</dd>
                      </div>
                      <div>
                        <dt>Expires</dt>
                        <dd>{new Date(license.expires_at).toLocaleDateString()}</dd>
                      </div>
                      <div>
                        <dt>Points</dt>
                        <dd>{license.points ?? 0}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })
            ) : (
              <div className={styles.empty}>No licences have been issued.</div>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <header className={styles.heading}>
            <div>
              <span>Application history</span>
              <h2>Tests and approvals</h2>
            </div>
          </header>

          <div className={styles.history}>
            {applications.length ? (
              applications.map((application) => {
                const type = Array.isArray(application.license_type)
                  ? application.license_type[0]
                  : application.license_type;

                return (
                  <article key={application.id}>
                    <div className={styles.applicationTop}>
                      <FileText size={19} />
                      <div>
                        <b>{type?.name}</b>
                        <code>{application.application_number}</code>
                      </div>
                      <span className={styles.applicationStatus}>
                        {application.status.replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className={styles.testRows}>
                      <span>
                        {application.written_status === "passed" ? (
                          <CheckCircle2 />
                        ) : application.written_status === "failed" ? (
                          <XCircle />
                        ) : (
                          <Clock3 />
                        )}
                        Written: {application.written_status}
                      </span>

                      <span>
                        {application.practical_status === "passed" ? (
                          <CheckCircle2 />
                        ) : application.practical_status === "failed" ? (
                          <XCircle />
                        ) : (
                          <Clock3 />
                        )}
                        Practical: {application.practical_status}
                      </span>
                    </div>

                    {["pending", "failed"].includes(application.written_status) && (
                      <Link
                        href={`/licenses/tests/${application.id}`}
                        className={styles.testButton}
                      >
                        {application.written_status === "failed"
                          ? "Retake written test"
                          : "Take written test"}
                      </Link>
                    )}

                    {application.written_status === "passed" &&
                      application.practical_status === "pending" && (
                        <div className={styles.notice}>
                          Written test passed. A DMV examiner must complete your
                          practical test.
                        </div>
                      )}

                    <small>
                      <CalendarDays size={13} />
                      Submitted {new Date(application.created_at).toLocaleString()}
                    </small>
                  </article>
                );
              })
            ) : (
              <div className={styles.empty}>No applications submitted.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
