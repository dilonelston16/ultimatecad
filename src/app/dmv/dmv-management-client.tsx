"use client";

import {
  Ban,
  CheckCircle2,
  CircleMinus,
  CirclePlus,
  ClipboardCheck,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserRoundSearch,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dmv-management.module.css";

type Props = {
  applications: any[];
  licenses: any[];
  characters: any[];
};

export default function DmvManagementClient({
  applications,
  licenses,
  characters,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState(1);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"applications" | "characters" | "licenses">(
    "applications"
  );

  const query = search.trim().toLowerCase();

  const filteredApplications = useMemo(
    () =>
      applications.filter((application) => {
        const character = Array.isArray(application.character)
          ? application.character[0]
          : application.character;
        const type = Array.isArray(application.license_type)
          ? application.license_type[0]
          : application.license_type;

        return [
          character?.first_name,
          character?.last_name,
          character?.state_id,
          application.application_number,
          type?.name,
          type?.code,
          application.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
    [applications, query]
  );

  const filteredCharacters = useMemo(
    () =>
      characters.filter((character) =>
        [
          character.first_name,
          character.last_name,
          character.state_id,
          character.is_archived ? "archived" : "active",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      ),
    [characters, query]
  );

  const filteredLicenses = useMemo(
    () =>
      licenses.filter((license) => {
        const character = Array.isArray(license.character)
          ? license.character[0]
          : license.character;
        const type = Array.isArray(license.license_type)
          ? license.license_type[0]
          : license.license_type;

        return [
          character?.first_name,
          character?.last_name,
          character?.state_id,
          license.license_number,
          type?.name,
          type?.code,
          license.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
    [licenses, query]
  );

  async function recordTest(
    applicationId: string,
    testType: "written" | "practical",
    passed: boolean
  ) {
    const scoreInput = window.prompt(
      `${testType === "practical" ? "Practical" : "Written"} score (optional):`,
      passed ? "100" : "0"
    );
    const notes =
      window.prompt(
        `Examiner notes for this ${testType} test:`,
        passed ? "Test passed." : "Test failed."
      ) ?? "";

    setBusy(`${applicationId}-${testType}-${passed}`);
    setMessage("");

    const response = await fetch("/api/dmv/tests/record", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId,
        testType,
        passed,
        score: scoreInput,
        notes,
      }),
    });

    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error ?? "Test result could not be recorded.");
      return;
    }

    setMessage(
      `${testType === "practical" ? "Practical" : "Written"} test recorded.`
    );
    router.refresh();
  }

  async function finalize(applicationId: string, decision: "approve" | "deny") {
    setBusy(`${applicationId}-${decision}`);
    setMessage("");

    const response = await fetch("/api/dmv/applications/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId,
        decision,
        notes: reason,
      }),
    });

    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error ?? "Application action failed.");
      return;
    }

    setMessage(
      decision === "approve"
        ? "Licence approved and issued."
        : "Application denied."
    );
    setReason("");
    router.refresh();
  }

  async function licenseAction(licenseId: string, action: string) {
    setBusy(`${licenseId}-${action}`);
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

    setMessage("Licence updated.");
    setReason("");
    router.refresh();
  }

  return (
    <div className={styles.stack}>
      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.searchPanel}>
        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, State ID, application number, licence number, or type..."
          />
        </div>

        <div className={styles.tabs}>
          <button
            className={tab === "applications" ? styles.activeTab : ""}
            onClick={() => setTab("applications")}
          >
            Applications
            <span>{applications.length}</span>
          </button>
          <button
            className={tab === "characters" ? styles.activeTab : ""}
            onClick={() => setTab("characters")}
          >
            Characters
            <span>{characters.length}</span>
          </button>
          <button
            className={tab === "licenses" ? styles.activeTab : ""}
            onClick={() => setTab("licenses")}
          >
            Licences
            <span>{licenses.length}</span>
          </button>
        </div>
      </section>

      {tab === "applications" && (
        <section className={styles.panel}>
          <header className={styles.heading}>
            <div>
              <span className={styles.eyebrow}>Application workflow</span>
              <h2>Licence applications</h2>
              <p>
                Written and practical requirements can be completed here before
                final approval.
              </p>
            </div>
            <div className={styles.count}>{filteredApplications.length}</div>
          </header>

          <label className={styles.field}>
            <span>Decision notes or reason</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Used for approvals, denials, suspensions, and revocations."
            />
          </label>

          <div className={styles.recordList}>
            {filteredApplications.length ? (
              filteredApplications.map((application) => {
                const character = Array.isArray(application.character)
                  ? application.character[0]
                  : application.character;
                const type = Array.isArray(application.license_type)
                  ? application.license_type[0]
                  : application.license_type;

                const testReady =
                  ["passed", "not_required"].includes(
                    application.written_status
                  ) &&
                  ["passed", "not_required"].includes(
                    application.practical_status
                  );

                return (
                  <article
                    className={styles.applicationCard}
                    key={application.id}
                  >
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

                    <div className={styles.workflow}>
                      <div className={styles.testState}>
                        <span>Written</span>
                        <b className={styles[application.written_status] ?? ""}>
                          {application.written_status}
                        </b>

                        {application.written_status !== "not_required" &&
                          application.written_status !== "passed" && (
                            <div>
                              <button
                                onClick={() =>
                                  recordTest(
                                    application.id,
                                    "written",
                                    true
                                  )
                                }
                              >
                                Pass
                              </button>
                              <button
                                onClick={() =>
                                  recordTest(
                                    application.id,
                                    "written",
                                    false
                                  )
                                }
                              >
                                Fail
                              </button>
                            </div>
                          )}
                      </div>

                      <div className={styles.testState}>
                        <span>Practical</span>
                        <b
                          className={
                            styles[application.practical_status] ?? ""
                          }
                        >
                          {application.practical_status}
                        </b>

                        {application.practical_status !== "not_required" &&
                          application.practical_status !== "passed" && (
                            <div>
                              <button
                                onClick={() =>
                                  recordTest(
                                    application.id,
                                    "practical",
                                    true
                                  )
                                }
                              >
                                Pass
                              </button>
                              <button
                                onClick={() =>
                                  recordTest(
                                    application.id,
                                    "practical",
                                    false
                                  )
                                }
                              >
                                Fail
                              </button>
                            </div>
                          )}
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <span
                        className={`${styles.applicationStatus} ${
                          testReady ? styles.ready : ""
                        }`}
                      >
                        {testReady
                          ? "Ready for approval"
                          : application.status.replaceAll("_", " ")}
                      </span>

                      <button
                        className={styles.primary}
                        disabled={
                          !testReady ||
                          busy === `${application.id}-approve`
                        }
                        onClick={() =>
                          finalize(application.id, "approve")
                        }
                      >
                        <CheckCircle2 size={16} />
                        Approve and issue
                      </button>

                      <button
                        className={styles.danger}
                        disabled={busy === `${application.id}-deny`}
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
                <ClipboardCheck size={32} />
                <h3>No applications found</h3>
                <p>Try another name, State ID, or application number.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "characters" && (
        <section className={styles.panel}>
          <header className={styles.heading}>
            <div>
              <span className={styles.eyebrow}>Character lookup</span>
              <h2>DMV character search</h2>
              <p>
                Search every community character and view their active
                applications and issued licences.
              </p>
            </div>
            <div className={styles.count}>{filteredCharacters.length}</div>
          </header>

          <div className={styles.characterGrid}>
            {filteredCharacters.map((character) => {
              const characterApplications = applications.filter((application) => {
                const raw = Array.isArray(application.character)
                  ? application.character[0]
                  : application.character;
                return raw?.id === character.id;
              });

              const characterLicenses = licenses.filter((license) => {
                const raw = Array.isArray(license.character)
                  ? license.character[0]
                  : license.character;
                return raw?.id === character.id;
              });

              return (
                <article key={character.id}>
                  <div className={styles.characterHeader}>
                    <UserRoundSearch />
                    <div>
                      <h3>
                        {character.first_name} {character.last_name}
                      </h3>
                      <code>{character.state_id}</code>
                    </div>
                    <span>
                      {character.is_archived ? "Archived" : "Active"}
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>Applications</dt>
                      <dd>{characterApplications.length}</dd>
                    </div>
                    <div>
                      <dt>Licences</dt>
                      <dd>{characterLicenses.length}</dd>
                    </div>
                    <div>
                      <dt>Date of birth</dt>
                      <dd>
                        {character.date_of_birth
                          ? new Date(
                              character.date_of_birth
                            ).toLocaleDateString()
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  <div className={styles.characterRecords}>
                    {characterApplications.map((application) => {
                      const type = Array.isArray(application.license_type)
                        ? application.license_type[0]
                        : application.license_type;
                      return (
                        <span key={application.id}>
                          Application: {type?.name} ·{" "}
                          {application.status.replaceAll("_", " ")}
                        </span>
                      );
                    })}
                    {characterLicenses.map((license) => {
                      const type = Array.isArray(license.license_type)
                        ? license.license_type[0]
                        : license.license_type;
                      return (
                        <span key={license.id}>
                          Licence: {type?.name} · {license.status} ·{" "}
                          {license.points ?? 0} points
                        </span>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "licenses" && (
        <section className={styles.panel}>
          <header className={styles.heading}>
            <div>
              <span className={styles.eyebrow}>Issued credentials</span>
              <h2>Licence management</h2>
              <p>
                Suspend, revoke, reinstate, renew, or adjust driver points.
              </p>
            </div>
            <div className={styles.count}>{filteredLicenses.length}</div>
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
          </div>

          <div className={styles.licenseGrid}>
            {filteredLicenses.map((license) => {
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
                        {new Date(license.issued_at).toLocaleDateString()}
                      </dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>
                        {new Date(license.expires_at).toLocaleDateString()}
                      </dd>
                    </div>
                  </dl>

                  <div className={styles.actionGrid}>
                    <button
                      onClick={() =>
                        licenseAction(license.id, "suspend")
                      }
                    >
                      <Ban size={15} />
                      Suspend
                    </button>
                    <button
                      onClick={() => licenseAction(license.id, "revoke")}
                    >
                      <ShieldOff size={15} />
                      Revoke
                    </button>
                    <button
                      onClick={() =>
                        licenseAction(license.id, "reinstate")
                      }
                    >
                      <ShieldCheck size={15} />
                      Reinstate
                    </button>
                    <button
                      onClick={() => licenseAction(license.id, "renew")}
                    >
                      <RefreshCcw size={15} />
                      Renew
                    </button>
                    <button
                      onClick={() =>
                        licenseAction(license.id, "add_points")
                      }
                    >
                      <CirclePlus size={15} />
                      Add points
                    </button>
                    <button
                      onClick={() =>
                        licenseAction(license.id, "remove_points")
                      }
                    >
                      <CircleMinus size={15} />
                      Remove points
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
