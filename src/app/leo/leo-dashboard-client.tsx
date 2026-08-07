"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  BookOpenCheck,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FilePlus2,
  Gavel,
  Headphones,
  MapPin,
  Radio,
  Search,
  ShieldAlert,
  Siren,
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

export default function LeoDashboardClient({
  communityId,
  userProfile,
  unitProfile,
  activeShift,
  units,
  calls,
  assignments,
  panicAlerts,
  bolos,
  organization,
  canSelfDispatch,
  canManageCalls,
  loadError = "",
}: any) {
  const router = useRouter();
  const [message, setMessage] = useState(loadError);
  const [busy, setBusy] = useState("");
  const [clockFormOpen, setClockFormOpen] = useState(!activeShift);
  const [callFormOpen, setCallFormOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const agencies = organization.filter((node: any) => node.node_type === "agency");
  const departments = organization.filter((node: any) => node.node_type === "department");
  const divisions = organization.filter((node: any) => node.node_type === "division");
  const subdivisions = organization.filter((node: any) => node.node_type === "subdivision");

  const assignmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach((assignment: any) => {
      map.set(assignment.call_id, (map.get(assignment.call_id) ?? 0) + 1);
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

  async function clockIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const ok = await api("/api/leo/shift", {
      action: "clock_in",
      communityId,
      callsign: form.get("callsign"),
      badgeNumber: form.get("badgeNumber"),
      rankName: form.get("rankName"),
      consolePlatform: form.get("consolePlatform"),
      agencyNodeId: form.get("agencyNodeId") || null,
      departmentNodeId: form.get("departmentNodeId") || null,
      divisionNodeId: form.get("divisionNodeId") || null,
      subdivisionNodeId: form.get("subdivisionNodeId") || null,
    });

    if (ok) {
      setMessage("Clocked in and connected to the unit board.");
      setClockFormOpen(false);
    }
  }

  async function updateShift(action: string, status?: string) {
    if (!activeShift) return;

    const ok = await api("/api/leo/shift", {
      action,
      shiftId: activeShift.id,
      status,
    });

    if (ok) {
      setMessage(action === "clock_out" ? "Shift ended." : "Unit status updated.");
    }
  }

  async function createCall(event: React.FormEvent<HTMLFormElement>) {
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
      event.currentTarget.reset();
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

  async function panic() {
    if (!activeShift) {
      setMessage("Clock in before activating panic.");
      return;
    }

    const location = window.prompt("Current location or postal:", "") || "";
    const ok = await api("/api/leo/panic", {
      shiftId: activeShift.id,
      location,
      message: "Officer activated emergency panic",
    });

    if (ok) {
      setMessage("PANIC ACTIVATED — all connected units have been alerted.");
      try {
        const audio = new Audio(
          "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
        );
        void audio.play();
      } catch {}
    }
  }

  async function searchMdt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;

    setBusy("search");
    const response = await fetch(
      `/api/leo/search?communityId=${encodeURIComponent(communityId)}&q=${encodeURIComponent(query)}`
    );
    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error || "Search failed.");
      return;
    }

    setSearchResults(body.results ?? []);
  }

  const displayName =
    userProfile?.display_name || userProfile?.username || "Officer";

  return (
    <div className={styles.page}>
      {message && <div className={styles.message}>{message}</div>}

      {panicAlerts.length > 0 && (
        <section className={styles.panicBanner}>
          <Siren />
          <div>
            <strong>ACTIVE PANIC ALERT</strong>
            <span>
              {panicAlerts[0]?.unit?.unit?.callsign || "Unit"} ·{" "}
              {panicAlerts[0].location || "Location unavailable"} ·{" "}
              {panicAlerts[0].message}
            </span>
          </div>
          <b>{panicAlerts.length}</b>
        </section>
      )}

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>LAW ENFORCEMENT OPERATIONS</span>
          <h1>Good evening, {displayName}</h1>
          <p>
            {unitProfile?.rank_name || "LEO Member"} ·{" "}
            {unitProfile?.callsign || "Not clocked in"} ·{" "}
            {unitProfile?.console_platform || "Console not set"}
          </p>
        </div>

        <div className={styles.heroActions}>
          <button className={styles.searchButton} onClick={() => setSearchOpen(true)}>
            <Search />
            Search MDT
          </button>
          <button className={styles.panicButton} onClick={panic}>
            <Siren />
            PANIC
          </button>
        </div>
      </section>

      <section className={styles.shiftPanel}>
        <div className={styles.shiftIdentity}>
          <span className={activeShift ? styles.onlineDot : styles.offlineDot} />
          <div>
            <b>{activeShift ? "ON DUTY" : "OFF DUTY"}</b>
            <small>
              {activeShift
                ? `${unitProfile?.callsign || "Unit"} · ${activeShift.status.replaceAll("_", " ")}`
                : "Clock in to connect to CAD operations"}
            </small>
          </div>
        </div>

        {activeShift ? (
          <>
            <select
              value={activeShift.status}
              onChange={(event) => updateShift("status", event.target.value)}
              aria-label="Unit status"
            >
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button onClick={() => updateShift("clock_out")}>Clock Out</button>
          </>
        ) : (
          <button onClick={() => setClockFormOpen(true)}>Clock In</button>
        )}
      </section>

      {clockFormOpen && !activeShift && (
        <form className={styles.formPanel} onSubmit={clockIn}>
          <header>
            <Radio />
            <div>
              <h2>Start LEO Shift</h2>
              <p>Set your operational identity for the active unit board.</p>
            </div>
            <button type="button" onClick={() => setClockFormOpen(false)}>
              <X />
            </button>
          </header>

          <div className={styles.formGrid}>
            <label>
              Callsign
              <input name="callsign" defaultValue={unitProfile?.callsign || ""} required />
            </label>
            <label>
              Badge number
              <input name="badgeNumber" defaultValue={unitProfile?.badge_number || ""} />
            </label>
            <label>
              Rank
              <input name="rankName" defaultValue={unitProfile?.rank_name || ""} placeholder="Officer" />
            </label>
            <label>
              Console
              <select name="consolePlatform" defaultValue={unitProfile?.console_platform || "ps5"}>
                <option value="ps4">PS4</option>
                <option value="ps5">PS5</option>
                <option value="xbox_one">Xbox One</option>
                <option value="xbox_series">Xbox Series X|S</option>
              </select>
            </label>
            <label>
              Agency
              <select name="agencyNodeId" defaultValue={unitProfile?.agency_node_id || ""}>
                <option value="">Not selected</option>
                {agencies.map((node: any) => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>
            <label>
              Department
              <select name="departmentNodeId" defaultValue={unitProfile?.department_node_id || ""}>
                <option value="">Not selected</option>
                {departments.map((node: any) => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>
            <label>
              Division
              <select name="divisionNodeId" defaultValue={unitProfile?.division_node_id || ""}>
                <option value="">Not selected</option>
                {divisions.map((node: any) => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>
            <label>
              Subdivision
              <select name="subdivisionNodeId" defaultValue={unitProfile?.subdivision_node_id || ""}>
                <option value="">Not selected</option>
                {subdivisions.map((node: any) => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>
          </div>

          <button className={styles.primaryButton} disabled={busy === "clock_in"}>
            {busy === "clock_in" ? "Connecting…" : "Clock In"}
          </button>
        </form>
      )}

      <section className={styles.stats}>
        <article>
          <Headphones />
          <span>Active Calls</span>
          <strong>{calls.length}</strong>
          <small>{calls.filter((call: any) => call.priority === 1).length} priority-one</small>
        </article>
        <article>
          <Users />
          <span>Connected Units</span>
          <strong>{units.length}</strong>
          <small>{units.filter((unit: any) => unit.status === "available").length} available</small>
        </article>
        <article>
          <ShieldAlert />
          <span>Active BOLOs</span>
          <strong>{bolos.length}</strong>
          <small>{bolos.filter((bolo: any) => bolo.risk_level === "high").length} high risk</small>
        </article>
        <article>
          <BellRing />
          <span>Panic Alerts</span>
          <strong>{panicAlerts.length}</strong>
          <small>CAD-wide emergency alerts</small>
        </article>
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>LIVE OPERATIONS</span>
              <h2>Active Calls</h2>
            </div>
            {canManageCalls && (
              <button onClick={() => setCallFormOpen(true)}>
                <FilePlus2 />
                Create Call
              </button>
            )}
          </header>

          <div className={styles.callList}>
            {calls.length ? (
              calls.map((call: any) => (
                <article key={call.id} className={styles.callCard}>
                  <div className={`${styles.priority} ${styles[`priority${call.priority}`]}`}>
                    P{call.priority}
                  </div>
                  <div className={styles.callCopy}>
                    <span>{call.call_number}</span>
                    <h3>{call.title}</h3>
                    <p>
                      <MapPin /> {call.location}
                      {call.postal ? ` · Postal ${call.postal}` : ""}
                    </p>
                  </div>
                  <div className={styles.callMeta}>
                    <b>{assignmentCounts.get(call.id) ?? 0} units</b>
                    <small>{call.status}</small>
                    {canSelfDispatch && activeShift && (
                      <button onClick={() => selfDispatch(call.id)}>
                        Self Dispatch
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className={styles.empty}>
                <CheckCircle2 />
                <h3>No active calls</h3>
                <p>Operations are currently clear.</p>
              </div>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>CONNECTED PERSONNEL</span>
              <h2>Unit Board</h2>
            </div>
          </header>

          <div className={styles.unitList}>
            {units.length ? (
              units.map((shift: any) => {
                const rawUnit = shift.unit;
                const unit = Array.isArray(rawUnit) ? rawUnit[0] : rawUnit;
                const rawUser = unit?.user;
                const person = Array.isArray(rawUser) ? rawUser[0] : rawUser;

                return (
                  <article key={shift.id}>
                    <div className={styles.unitCallsign}>
                      <b>{unit?.callsign || "UNIT"}</b>
                      <span>{unit?.console_platform || "console"}</span>
                    </div>
                    <div>
                      <h3>{person?.display_name || person?.username || "Officer"}</h3>
                      <p>{unit?.rank_name || "LEO"} · {unit?.badge_number || "No badge"}</p>
                    </div>
                    <div className={`${styles.unitStatus} ${styles[shift.status]}`}>
                      {shift.status.replaceAll("_", " ")}
                    </div>
                    <small>{shift.current_assignment || "Patrol"}</small>
                  </article>
                );
              })
            ) : (
              <div className={styles.empty}>
                <Radio />
                <h3>No connected units</h3>
                <p>Clock in to appear on the board.</p>
              </div>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>TOOLS</span>
              <h2>Quick Actions</h2>
            </div>
          </header>

          <div className={styles.quickGrid}>
            <button onClick={() => setSearchOpen(true)}><UserRoundSearch />Person Search</button>
            <button onClick={() => setSearchOpen(true)}><Car />Plate / VIN Search</button>
            <button onClick={() => setCallFormOpen(true)}><FilePlus2 />Create Call</button>
            <button><Gavel />New Citation<small>Phase 2</small></button>
            <button><BookOpenCheck />New Report<small>Phase 2</small></button>
            <button className={styles.warningAction}><AlertTriangle />Request Backup</button>
            <button className={styles.panicAction} onClick={panic}><Siren />Activate Panic</button>
            {canSelfDispatch && <button><BadgeCheck />Supervisor Tools<small>Enabled</small></button>}
          </div>
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>ATTENTION</span>
              <h2>BOLOs & Notices</h2>
            </div>
          </header>

          <div className={styles.noticeList}>
            {bolos.length ? bolos.map((bolo: any) => (
              <article key={bolo.id}>
                <ShieldAlert />
                <div>
                  <b>{bolo.title}</b>
                  <p>{bolo.description}</p>
                  <span>{bolo.bolo_number} · {bolo.bolo_type} · {bolo.risk_level}</span>
                </div>
              </article>
            )) : (
              <article>
                <CheckCircle2 />
                <div>
                  <b>No active BOLOs</b>
                  <p>No person or vehicle lookout notices are active.</p>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>

      {callFormOpen && (
        <div className={styles.modalBackdrop}>
          <form className={styles.modal} onSubmit={createCall}>
            <header>
              <div>
                <span className={styles.eyebrow}>DISPATCH</span>
                <h2>Create Call</h2>
              </div>
              <button type="button" onClick={() => setCallFormOpen(false)}><X /></button>
            </header>
            <label>Call title<input name="title" required /></label>
            <div className={styles.twoColumns}>
              <label>Location<input name="location" required /></label>
              <label>Postal<input name="postal" /></label>
            </div>
            <label>Priority
              <select name="priority" defaultValue="3">
                <option value="1">Priority 1 — Emergency</option>
                <option value="2">Priority 2 — Urgent</option>
                <option value="3">Priority 3 — Routine</option>
                <option value="4">Priority 4 — Low</option>
                <option value="5">Priority 5 — Information</option>
              </select>
            </label>
            <label>Description<textarea name="description" /></label>
            <button className={styles.primaryButton}>Create Call</button>
          </form>
        </div>
      )}

      {searchOpen && (
        <div className={styles.modalBackdrop}>
          <section className={`${styles.modal} ${styles.searchModal}`}>
            <header>
              <div>
                <span className={styles.eyebrow}>GLOBAL MDT SEARCH</span>
                <h2>Search Records</h2>
              </div>
              <button onClick={() => setSearchOpen(false)}><X /></button>
            </header>

            <form className={styles.mdtSearch} onSubmit={searchMdt}>
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, State ID, plate, VIN, serial, property, business..."
                autoFocus
              />
              <button>{busy === "search" ? "Searching…" : "Search"}</button>
            </form>

            <div className={styles.searchResults}>
              {searchResults.length ? searchResults.map((result) => (
                <article key={`${result.type}-${result.id}`}>
                  <span>{result.type}</span>
                  <div>
                    <h3>{result.title}</h3>
                    <p>{result.subtitle}</p>
                  </div>
                  <ChevronRight />
                </article>
              )) : (
                <div className={styles.empty}>
                  <Search />
                  <h3>Search community records</h3>
                  <p>Results include people, vehicles, weapons, properties, and businesses.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
