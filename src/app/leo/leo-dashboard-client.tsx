"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  BookOpenCheck,
  Building2,
  Car,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  FilePlus2,
  Gavel,
  Headphones,
  IdCard,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  Radio,
  Search,
  ShieldAlert,
  Siren,
  Trash2,
  UserRound,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./leo-dashboard.module.css";

const statuses = [
  ["available", "Available"],
  ["busy", "Busy"],
  ["en_route", "En Route"],
  ["on_scene", "On Scene"],
  ["traffic_stop", "Traffic Stop"],
  ["transporting", "Transporting"],
  ["out_of_service", "Out of Service"],
  ["break", "Break"],
];

const quickActions = [
  ["New Report", BookOpenCheck, "Phase 2"],
  ["New Citation", Gavel, "Phase 2"],
  ["New Arrest", BadgeCheck, "Phase 2"],
  ["MDT Search", UserRoundSearch, "search"],
  ["Self Dispatch", Radio, "self"],
  ["BOLO Board", ShieldAlert, "Phase 2"],
  ["Warrant Check", Gavel, "Phase 2"],
  ["Request Backup", Siren, "panic"],
];

export default function LeoDashboardClient({
  communityId,
  userProfile,
  identifiers,
  selectedIdentifier,
  activeShift,
  units,
  calls,
  assignments,
  panicAlerts,
  bolos,
  organization,
  canSelfDispatch,
  canManageCalls,
  soundEnabled,
  loadError = "",
}: any) {
  const router = useRouter();
  const [message, setMessage] = useState(loadError);
  const [busy, setBusy] = useState("");
  const [identifierOpen, setIdentifierOpen] = useState(false);
  const [identifierEditorOpen, setIdentifierEditorOpen] = useState(false);
  const [editingIdentifier, setEditingIdentifier] = useState<any>(null);
  const [callFormOpen, setCallFormOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const activeIdentifiers = identifiers.filter(
    (identifier: any) => !identifier.is_archived
  );

  const archivedIdentifiers = identifiers.filter(
    (identifier: any) => identifier.is_archived
  );

  const selected =
    activeIdentifiers.find(
      (identifier: any) => identifier.id === selectedIdentifier?.id
    ) ??
    activeIdentifiers[0] ??
    null;

  const currentUnit =
    activeShift &&
    (units.find((unit: any) => unit.id === activeShift.id) ?? null);

  const agencies = organization.filter(
    (node: any) => node.node_type === "agency"
  );
  const departments = organization.filter(
    (node: any) => node.node_type === "department"
  );
  const divisions = organization.filter(
    (node: any) => node.node_type === "division"
  );
  const subdivisions = organization.filter(
    (node: any) => node.node_type === "subdivision"
  );

  const nodeName = (id?: string | null) =>
    organization.find((node: any) => node.id === id)?.name ?? null;

  const departmentName =
    nodeName(selected?.department_node_id) ??
    nodeName(selected?.agency_node_id) ??
    "Law Enforcement";

  const divisionName =
    nodeName(selected?.division_node_id) ??
    nodeName(selected?.subdivision_node_id) ??
    "Patrol Division";

  const assignmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach((assignment: any) => {
      map.set(
        assignment.call_id,
        (map.get(assignment.call_id) ?? 0) + 1
      );
    });
    return map;
  }, [assignments]);

  async function api(url: string, payload: any) {
    setBusy(payload.action || url);
    setMessage("");

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error || "LEO action failed.");
      return false;
    }

    router.refresh();
    return true;
  }

  async function saveIdentifier(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const certifications = String(
      form.get("certifications") || ""
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const ok = await api("/api/leo/identifiers", {
      action: "save",
      communityId,
      identifierId: editingIdentifier?.id || null,
      identifierName: form.get("identifierName"),
      callsign: form.get("callsign"),
      badgeNumber: form.get("badgeNumber"),
      rankName: form.get("rankName"),
      consolePlatform: form.get("consolePlatform"),
      agencyNodeId: form.get("agencyNodeId") || null,
      departmentNodeId: form.get("departmentNodeId") || null,
      divisionNodeId: form.get("divisionNodeId") || null,
      subdivisionNodeId: form.get("subdivisionNodeId") || null,
      isDefault: form.get("isDefault") === "on",
      defaultStatus: form.get("defaultStatus"),
      certifications,
    });

    if (ok) {
      setMessage(
        editingIdentifier
          ? "Identifier updated."
          : "Identifier created and saved."
      );
      setIdentifierEditorOpen(false);
      setEditingIdentifier(null);
    }
  }

  async function selectIdentifier(identifierId: string) {
    const ok = await api("/api/leo/identifiers", {
      action: "select",
      identifierId,
    });

    if (ok) {
      setIdentifierOpen(false);
      setMessage("Identifier switched.");
    }
  }

  async function archiveIdentifier(
    identifierId: string,
    restore = false
  ) {
    const ok = await api("/api/leo/identifiers", {
      action: restore ? "restore" : "archive",
      identifierId,
    });

    if (ok) {
      setMessage(
        restore ? "Identifier restored." : "Identifier archived."
      );
    }
  }

  async function clockIn() {
    if (!selected) {
      setMessage("Create an identifier before starting a shift.");
      setIdentifierEditorOpen(true);
      return;
    }

    const ok = await api("/api/leo/shift", {
      action: "clock_in",
      identifierId: selected.id,
    });

    if (ok) setMessage(`Clocked in as ${selected.identifier_name}.`);
  }

  async function updateShift(action: string, status?: string) {
    if (!activeShift) return;

    const ok = await api("/api/leo/shift", {
      action,
      shiftId: activeShift.id,
      status,
    });

    if (ok) {
      setMessage(
        action === "clock_out"
          ? "Shift ended."
          : "Unit status updated."
      );
    }
  }

  async function panic() {
    if (!activeShift) {
      setMessage("Clock in before activating panic.");
      return;
    }

    const location =
      window.prompt("Current location or postal:", "") || "";

    const ok = await api("/api/leo/panic", {
      shiftId: activeShift.id,
      location,
      message: "Officer activated emergency panic",
    });

    if (ok) {
      setMessage(
        "PANIC ACTIVATED — all connected units have been alerted."
      );

      if (soundEnabled) {
        try {
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 880;
          gain.gain.value = 0.08;
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          setTimeout(() => {
            oscillator.stop();
            void context.close();
          }, 450);
        } catch {}
      }
    }
  }

  async function createCall(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const ok = await api("/api/leo/calls", {
      communityId,
      title: form.get("title"),
      location: form.get("location"),
      postal: form.get("postal"),
      priority: form.get("priority"),
      description: form.get("description"),
    });

    if (ok) {
      setMessage("Call created.");
      setCallFormOpen(false);
    }
  }

  async function selfDispatch(callId: string) {
    if (!activeShift) {
      setMessage("Clock in before self-dispatching.");
      return;
    }

    const ok = await api("/api/leo/calls", {
      action: "self_dispatch",
      callId,
      shiftId: activeShift.id,
    });

    if (ok) setMessage("Self-dispatched to call.");
  }

  async function searchMdt(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (query.trim().length < 2) return;

    setBusy("search");

    const response = await fetch(
      `/api/leo/search?communityId=${encodeURIComponent(
        communityId
      )}&q=${encodeURIComponent(query)}`
    );

    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error || "Search failed.");
      return;
    }

    setSearchResults(body.results ?? []);
  }

  function handleQuickAction(action: string) {
    if (action === "search") setSearchOpen(true);
    else if (action === "panic") void panic();
    else if (action === "self") {
      if (!canSelfDispatch) {
        setMessage("Supervisor self-dispatch permission required.");
      } else {
        setMessage("Choose an active call and select Self Dispatch.");
      }
    } else {
      setMessage(`${action} will be activated in LEO Phase 2.`);
    }
  }

  const displayName =
    userProfile?.display_name ||
    userProfile?.username ||
    "Officer";

  const shiftSeconds = activeShift
    ? Math.max(
        0,
        Math.floor(
          (Date.now() -
            new Date(activeShift.clocked_in_at).getTime()) /
            1000
        )
      )
    : 0;

  const shiftText = new Date(shiftSeconds * 1000)
    .toISOString()
    .slice(11, 19);

  return (
    <div className={styles.workspace}>
      {message && (
        <div className={styles.message}>{message}</div>
      )}

      <header className={styles.commandBar}>
        <div className={styles.mobileBrand}>
          <Menu />
          <b>ULTIMATECAD</b>
        </div>

        <button
          className={styles.globalSearch}
          onClick={() => setSearchOpen(true)}
        >
          <Search />
          <span>
            Search by name, plate, VIN, case, report, etc...
          </span>
          <kbd>CTRL + K</kbd>
        </button>

        <div className={styles.commandActions}>
          <button className={styles.topPanic} onClick={panic}>
            <Siren />
            PANIC
          </button>
          <button className={styles.iconButton}>
            <MessageSquare />
          </button>
          <button className={styles.iconButton}>
            <Bell />
            {panicAlerts.length > 0 && (
              <span>{panicAlerts.length}</span>
            )}
          </button>

          <div className={styles.identityPicker}>
            <button
              onClick={() => setIdentifierOpen(!identifierOpen)}
            >
              <div className={styles.avatar}>
                <UserRound />
              </div>
              <div>
                <b>{displayName}</b>
                <span>
                  {selected?.callsign || "No identifier"} ·{" "}
                  {divisionName}
                </span>
                <small>
                  <CircleDot />{" "}
                  {activeShift ? "On Duty" : "Off Duty"}
                </small>
              </div>
              <ChevronDown />
            </button>

            {identifierOpen && (
              <div className={styles.identifierMenu}>
                <header>
                  <div>
                    <b>Saved Identifiers</b>
                    <span>
                      Choose the department identity you are using.
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingIdentifier(null);
                      setIdentifierEditorOpen(true);
                      setIdentifierOpen(false);
                    }}
                  >
                    <Plus />
                  </button>
                </header>

                <div className={styles.identifierList}>
                  {activeIdentifiers.map((identifier: any) => (
                    <article
                      key={identifier.id}
                      className={
                        selected?.id === identifier.id
                          ? styles.selectedIdentifier
                          : ""
                      }
                    >
                      <button
                        onClick={() =>
                          selectIdentifier(identifier.id)
                        }
                      >
                        <IdCard />
                        <div>
                          <b>{identifier.identifier_name}</b>
                          <span>
                            {identifier.callsign} ·{" "}
                            {nodeName(
                              identifier.department_node_id
                            ) || "Department"}
                          </span>
                        </div>
                        {identifier.is_default && (
                          <small>Default</small>
                        )}
                      </button>

                      <div>
                        <button
                          title="Edit identifier"
                          onClick={() => {
                            setEditingIdentifier(identifier);
                            setIdentifierEditorOpen(true);
                            setIdentifierOpen(false);
                          }}
                        >
                          <Pencil />
                        </button>
                        <button
                          title="Archive identifier"
                          onClick={() =>
                            archiveIdentifier(identifier.id)
                          }
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </article>
                  ))}

                  {!activeIdentifiers.length && (
                    <p>No saved identifiers.</p>
                  )}
                </div>

                {archivedIdentifiers.length > 0 && (
                  <details>
                    <summary>
                      Archived ({archivedIdentifiers.length})
                    </summary>
                    {archivedIdentifiers.map(
                      (identifier: any) => (
                        <button
                          key={identifier.id}
                          className={styles.restoreButton}
                          onClick={() =>
                            archiveIdentifier(identifier.id, true)
                          }
                        >
                          Restore {identifier.identifier_name}
                        </button>
                      )
                    )}
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {panicAlerts.length > 0 && (
        <section className={styles.panicStrip}>
          <Siren />
          <strong>ACTIVE OFFICER PANIC</strong>
          <span>
            {panicAlerts[0]?.unit?.unit?.callsign || "Unit"} ·{" "}
            {panicAlerts[0].location || "Unknown location"}
          </span>
          <b>{panicAlerts.length}</b>
        </section>
      )}

      <section className={styles.dashboardHeading}>
        <div className={styles.departmentBadge}>
          <ShieldAlert />
        </div>
        <div>
          <h1>{departmentName} Dashboard</h1>
          <p>{divisionName}</p>
        </div>

        <div className={styles.headingStatus}>
          <Clock3 />
          <div>
            <span>Shift Time</span>
            <strong>{activeShift ? shiftText : "00:00:00"}</strong>
          </div>
        </div>
      </section>

      <section className={styles.metrics}>
        {[
          ["Active Calls", calls.length, Headphones, "#2f8cff"],
          ["Units On Duty", units.length, Car, "#438dff"],
          ["Reports Today", 0, BookOpenCheck, "#9d52ff"],
          ["Citations Today", 0, Gavel, "#ff9f2d"],
          ["Arrests Today", 0, BadgeCheck, "#ff4949"],
          ["BOLOs Active", bolos.length, ShieldAlert, "#ff681f"],
        ].map(([label, value, Icon, color]: any) => (
          <article key={label}>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>
                {label === "Units On Duty"
                  ? `${units.filter(
                      (unit: any) =>
                        unit.status === "available"
                    ).length} available`
                  : "Live operational total"}
              </small>
            </div>
            <Icon style={{ color }} />
          </article>
        ))}
      </section>

      <section className={styles.dashboardGrid}>
        <div className={`${styles.panel} ${styles.callsPanel}`}>
          <header>
            <h2>Active Calls</h2>
            <button onClick={() => setCallFormOpen(true)}>
              View / Create
            </button>
          </header>

          <div className={styles.tableHeader}>
            <span>Priority</span>
            <span>Call Type</span>
            <span>Location</span>
            <span>Unit</span>
            <span>Time</span>
          </div>

          <div className={styles.callRows}>
            {calls.slice(0, 6).map((call: any) => (
              <article key={call.id}>
                <b
                  className={`${styles.priority} ${
                    styles[`priority${call.priority}`]
                  }`}
                >
                  {call.priority === 1 ? "911" : call.priority}
                </b>
                <strong>{call.title}</strong>
                <span>
                  {call.location}
                  {call.postal ? ` · ${call.postal}` : ""}
                </span>
                <span>
                  {assignmentCounts.get(call.id) ?? 0} assigned
                </span>
                <small>
                  {Math.max(
                    1,
                    Math.floor(
                      (Date.now() -
                        new Date(call.created_at).getTime()) /
                        60000
                    )
                  )}{" "}
                  min
                </small>
                {canSelfDispatch && activeShift && (
                  <button
                    onClick={() => selfDispatch(call.id)}
                  >
                    Dispatch
                  </button>
                )}
              </article>
            ))}

            {!calls.length && (
              <div className={styles.emptyPanel}>
                No active calls.
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.panel} ${styles.unitsPanel}`}>
          <header>
            <h2>Unit Status</h2>
            <span>{units.length} connected</span>
          </header>

          <div className={styles.tableHeader}>
            <span>Unit</span>
            <span>Officer(s)</span>
            <span>Status</span>
            <span>Location</span>
          </div>

          <div className={styles.unitRows}>
            {units.slice(0, 7).map((shift: any) => {
              const rawUnit = shift.unit;
              const unit = Array.isArray(rawUnit)
                ? rawUnit[0]
                : rawUnit;
              const rawPerson = unit?.user;
              const person = Array.isArray(rawPerson)
                ? rawPerson[0]
                : rawPerson;

              return (
                <article key={shift.id}>
                  <b>{unit?.callsign || "UNIT"}</b>
                  <span>
                    {person?.display_name ||
                      person?.username ||
                      "Officer"}
                  </span>
                  <strong
                    className={`${styles.statusCode} ${
                      styles[shift.status]
                    }`}
                  >
                    {shift.status.replaceAll("_", " ")}
                  </strong>
                  <small>
                    {shift.current_assignment || "Patrol"}
                  </small>
                </article>
              );
            })}

            {!units.length && (
              <div className={styles.emptyPanel}>
                No connected units.
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.panel} ${styles.boloPanel}`}>
          <header>
            <h2>BOLO Alerts</h2>
            <span>{bolos.length} active</span>
          </header>

          <div className={styles.boloRows}>
            {bolos.slice(0, 5).map((bolo: any) => (
              <article key={bolo.id}>
                <ShieldAlert />
                <div>
                  <b>{bolo.title}</b>
                  <p>{bolo.description}</p>
                  <span>
                    {bolo.bolo_number} · {bolo.risk_level}
                  </span>
                </div>
              </article>
            ))}

            {!bolos.length && (
              <div className={styles.emptyPanel}>
                No active BOLO alerts.
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.panel} ${styles.warrantPanel}`}>
          <header>
            <h2>Warrants</h2>
            <span>Phase 2</span>
          </header>

          <div className={styles.warrantRows}>
            {[
              ["Felony", 0, "#ef3d4e"],
              ["Misdemeanor", 0, "#ffb32e"],
              ["Traffic", 0, "#3188ff"],
              ["Parole Violation", 0, "#a464ff"],
            ].map(([label, count, color]: any) => (
              <article key={label}>
                <span style={{ background: color }} />
                <b>{label}</b>
                <strong>{count}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className={`${styles.panel} ${styles.reportsPanel}`}>
          <header>
            <h2>Recent Reports</h2>
            <span>Phase 2</span>
          </header>
          <div className={styles.placeholderRows}>
            <article>
              <span>IR-Coming next</span>
              <b>Incident reports will appear here</b>
              <small>Phase 2</small>
            </article>
          </div>
        </div>

        <div className={`${styles.panel} ${styles.citationsPanel}`}>
          <header>
            <h2>Recent Citations</h2>
            <span>Phase 2</span>
          </header>
          <div className={styles.placeholderRows}>
            <article>
              <span>CIT-Coming next</span>
              <b>Citations will appear here</b>
              <small>Phase 2</small>
            </article>
          </div>
        </div>

        <div className={`${styles.panel} ${styles.arrestsPanel}`}>
          <header>
            <h2>Arrests Today</h2>
            <span>Phase 2</span>
          </header>
          <div className={styles.placeholderRows}>
            <article>
              <span>AR-Coming next</span>
              <b>Arrest bookings will appear here</b>
              <small>Phase 2</small>
            </article>
          </div>
        </div>

        <aside className={styles.panicCard}>
          <header>Officer Panic Status</header>
          <p>
            Panic alerts are activated from the red PANIC button in the top command bar.
          </p>

          <div className={styles.panicStatus}>
            {panicAlerts.length ? (
              <>
                <AlertTriangle />
                <div>
                  <b>{panicAlerts.length} Active Panics</b>
                  <span>Immediate response required</span>
                </div>
              </>
            ) : (
              <>
                <CircleDot />
                <div>
                  <b>No Active Panics</b>
                  <span>All units clear</span>
                </div>
              </>
            )}
          </div>
        </aside>
      </section>

      <section className={styles.quickBar}>
        <header>LEO Quick Actions</header>
        <div>
          {quickActions.map(([label, Icon, action]: any) => (
            <button
              key={label}
              onClick={() => handleQuickAction(action)}
            >
              <Icon />
              <span>{label}</span>
              {action === "Phase 2" && <small>NEW</small>}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.shiftDock}>
        <div>
          <Clock3 />
          <span>Shift Time</span>
          <strong>{activeShift ? shiftText : "00:00:00"}</strong>
          <small>{activeShift ? "On Duty" : "Off Duty"}</small>
        </div>

        {activeShift ? (
          <>
            <select
              value={activeShift.status}
              onChange={(event) =>
                updateShift("status", event.target.value)
              }
            >
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button onClick={() => updateShift("clock_out")}>
              End Shift
            </button>
          </>
        ) : (
          <button onClick={clockIn}>
            Start Shift as {selected?.callsign || "Identifier"}
          </button>
        )}
      </section>

      {identifierEditorOpen && (
        <div className={styles.modalBackdrop}>
          <form
            className={styles.modal}
            onSubmit={saveIdentifier}
          >
            <header>
              <div>
                <span>Saved Department Identity</span>
                <h2>
                  {editingIdentifier
                    ? "Edit Identifier"
                    : "Create Identifier"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIdentifierEditorOpen(false);
                  setEditingIdentifier(null);
                }}
              >
                <X />
              </button>
            </header>

            <div className={styles.formGrid}>
              <label>
                Identifier name
                <input
                  name="identifierName"
                  defaultValue={
                    editingIdentifier?.identifier_name || ""
                  }
                  placeholder="LSPD Patrol"
                  required
                />
              </label>

              <label>
                Callsign
                <input
                  name="callsign"
                  defaultValue={
                    editingIdentifier?.callsign || ""
                  }
                  placeholder="2A-15"
                  required
                />
              </label>

              <label>
                Badge number
                <input
                  name="badgeNumber"
                  defaultValue={
                    editingIdentifier?.badge_number || ""
                  }
                />
              </label>

              <label>
                Rank
                <input
                  name="rankName"
                  defaultValue={
                    editingIdentifier?.rank_name || ""
                  }
                  placeholder="Officer"
                />
              </label>

              <label>
                Console
                <select
                  name="consolePlatform"
                  defaultValue={
                    editingIdentifier?.console_platform || "ps5"
                  }
                >
                  <option value="ps4">PS4</option>
                  <option value="ps5">PS5</option>
                  <option value="xbox_one">Xbox One</option>
                  <option value="xbox_series">
                    Xbox Series X|S
                  </option>
                </select>
              </label>

              <label>
                Default status
                <select
                  name="defaultStatus"
                  defaultValue={
                    editingIdentifier?.default_status ||
                    "available"
                  }
                >
                  {statuses.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Agency
                <select
                  name="agencyNodeId"
                  defaultValue={
                    editingIdentifier?.agency_node_id || ""
                  }
                >
                  <option value="">Not selected</option>
                  {agencies.map((node: any) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Department
                <select
                  name="departmentNodeId"
                  defaultValue={
                    editingIdentifier?.department_node_id || ""
                  }
                >
                  <option value="">Not selected</option>
                  {departments.map((node: any) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Division
                <select
                  name="divisionNodeId"
                  defaultValue={
                    editingIdentifier?.division_node_id || ""
                  }
                >
                  <option value="">Not selected</option>
                  {divisions.map((node: any) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Subdivision
                <select
                  name="subdivisionNodeId"
                  defaultValue={
                    editingIdentifier?.subdivision_node_id || ""
                  }
                >
                  <option value="">Not selected</option>
                  {subdivisions.map((node: any) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.full}>
                Certifications
                <input
                  name="certifications"
                  defaultValue={
                    editingIdentifier?.certifications?.join(", ") ||
                    ""
                  }
                  placeholder="FTO, Traffic, SWAT"
                />
              </label>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked={
                    editingIdentifier?.is_default || false
                  }
                />
                Make this my default identifier
              </label>
            </div>

            <button className={styles.primaryButton}>
              Save Identifier
            </button>
          </form>
        </div>
      )}

      {callFormOpen && (
        <div className={styles.modalBackdrop}>
          <form className={styles.modal} onSubmit={createCall}>
            <header>
              <div>
                <span>Dispatch</span>
                <h2>Create Call</h2>
              </div>
              <button
                type="button"
                onClick={() => setCallFormOpen(false)}
              >
                <X />
              </button>
            </header>

            <label>
              Call title
              <input name="title" required />
            </label>

            <div className={styles.twoColumns}>
              <label>
                Location
                <input name="location" required />
              </label>

              <label>
                Postal
                <input name="postal" />
              </label>
            </div>

            <label>
              Priority
              <select name="priority" defaultValue="3">
                <option value="1">Priority 1 — Emergency</option>
                <option value="2">Priority 2 — Urgent</option>
                <option value="3">Priority 3 — Routine</option>
                <option value="4">Priority 4 — Low</option>
                <option value="5">
                  Priority 5 — Information
                </option>
              </select>
            </label>

            <label>
              Description
              <textarea name="description" />
            </label>

            <button className={styles.primaryButton}>
              Create Call
            </button>
          </form>
        </div>
      )}

      {searchOpen && (
        <div className={styles.modalBackdrop}>
          <section
            className={`${styles.modal} ${styles.searchModal}`}
          >
            <header>
              <div>
                <span>Global MDT Search</span>
                <h2>Search Records</h2>
              </div>
              <button onClick={() => setSearchOpen(false)}>
                <X />
              </button>
            </header>

            <form
              className={styles.mdtSearch}
              onSubmit={searchMdt}
            >
              <Search />
              <input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Name, State ID, plate, VIN, serial, property, business..."
                autoFocus
              />
              <button>
                {busy === "search" ? "Searching…" : "Search"}
              </button>
            </form>

            <div className={styles.searchResults}>
              {searchResults.length ? (
                searchResults.map((result) => (
                  <article
                    key={`${result.type}-${result.id}`}
                  >
                    <span>{result.type}</span>
                    <div>
                      <h3>{result.title}</h3>
                      <p>{result.subtitle}</p>
                    </div>
                    <ChevronRight />
                  </article>
                ))
              ) : (
                <div className={styles.emptyPanel}>
                  Search community records.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
