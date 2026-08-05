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
        ["submitted", "testing", "ready_for_review"].includes(application.status)
    );

  const hasValid = (typeId: string) =>
    licenses.some(
      (license) =>
        license.license_type_id === typeId && license.status === "valid"
    );

  return (
    <div className="dmv-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Available credentials</span>
            <h2>Apply for a license</h2>
            <p>
              Apply, complete the written exam, then finish any required practical
              evaluation.
            </p>
          </div>
        </div>

        {message && <div className="status-banner">{message}</div>}

        <div className="license-type-list">
          {types.map((type) => (
            <article key={type.id}>
              <div className={`license-type-icon ${type.category}`}>
                <Shield />
              </div>
              <div className="license-type-copy">
                <div>
                  <b>{type.name}</b>
                  <code>{type.code}</code>
                </div>
                <p>{type.description}</p>
                <div className="license-requirements">
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
                className="button compact"
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

      <div className="dmv-side-stack">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Issued credentials</span>
              <h2>My licenses</h2>
            </div>
          </div>
          <div className="issued-license-list">
            {licenses.length ? (
              licenses.map((license) => (
                <article
                  key={license.id}
                  className={`issued-license ${license.status}`}
                >
                  <div>
                    <BadgeCheck />
                    <span>
                      {Array.isArray(license.license_type)
                        ? license.license_type[0]?.name
                        : license.license_type?.name}
                    </span>
                  </div>
                  <code>{license.license_number}</code>
                  <dl>
                    <div>
                      <dt>Status</dt>
                      <dd>{license.status}</dd>
                    </div>
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
                      <dd>{license.points}</dd>
                    </div>
                  </dl>
                </article>
              ))
            ) : (
              <div className="empty-state">No licenses have been issued.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Application history</span>
              <h2>Tests and approvals</h2>
            </div>
          </div>

          <div className="application-history">
            {applications.length ? (
              applications.map((application) => (
                <article key={application.id}>
                  <div className="application-line">
                    <div>
                      <FileText />
                      <span>
                        <b>
                          {Array.isArray(application.license_type)
                            ? application.license_type[0]?.name
                            : application.license_type?.name}
                        </b>
                        <code>{application.application_number}</code>
                      </span>
                    </div>
                    <span className={`status-pill ${application.status}`}>
                      {application.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="test-status-row">
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
                      className="button compact written-test-action"
                    >
                      {application.written_status === "failed"
                        ? "Retake written test"
                        : "Take written test"}
                    </Link>
                  )}

                  {application.written_status === "passed" &&
                    application.practical_status === "pending" && (
                      <div className="practical-test-note">
                        Written test passed. A DMV examiner must complete your
                        practical test.
                      </div>
                    )}

                  <small>
                    <CalendarDays />
                    Submitted {new Date(application.created_at).toLocaleString()}
                  </small>
                </article>
              ))
            ) : (
              <div className="empty-state">No applications submitted.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
