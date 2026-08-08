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
  ["New Report", BookOpenCheck, "report"],
  ["New Citation", Gavel, "citation"],
  ["New Arrest", BadgeCheck, "arrest"],
  ["MDT Search", UserRoundSearch, "search"],
  ["Self Dispatch", Radio, "self"],
  ["BOLO Board", ShieldAlert, "bolo"],
  ["Warrant Check", Gavel, "search"],
  ["Request Backup", Siren, "backup"],
  ["Traffic Stop", Car, "traffic"],
  ["Tow Request", MapPin, "tow"],
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
  records = [], warrants = [], penalCodes = [], trafficStops = [], towRequests = [], bookings = [], backupRequests = [],
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
  const [recordFormOpen, setRecordFormOpen] = useState<string>("");
  const [recordSubject, setRecordSubject] = useState<any>(null);
  const [selectedCharges, setSelectedCharges] = useState<any[]>([]);
  const [penalQuery, setPenalQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedCharacterRecord, setSelectedCharacterRecord] = useState<any>(null);
  const [characterRecordLoading, setCharacterRecordLoading] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState("");
  const [panicBoardOpen, setPanicBoardOpen] = useState(false);
  const [operationFormOpen, setOperationFormOpen] = useState<"backup"|"traffic"|"tow"|"">("");

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

  async function resolvePanic(alertId: string) {
    const ok = await api("/api/leo/panic", { action: "resolve", alertId });
    if (ok) {
      setMessage("Panic cleared and unit returned to available.");
      if (panicAlerts.length <= 1) setPanicBoardOpen(false);
    }
  }

  async function submitOperation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeShift || !selected) {
      setMessage("Clock in before starting an operational action.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const location = String(form.get("location") || "");
    const reason = String(form.get("reason") || "");
    let payload:any = { communityId, location, reason, identifierId:selected.id, shiftId:activeShift.id };
    if (operationFormOpen === "backup") payload = { ...payload, action:"request_backup", priority:form.get("priority") || "normal" };
    if (operationFormOpen === "traffic") payload = { ...payload, action:"traffic_stop" };
    if (operationFormOpen === "tow") payload = { ...payload, action:"tow_request", priority:form.get("priority") || "normal" };
    const ok = await api("/api/leo/operations", payload);
    if (ok) {
      setMessage(operationFormOpen === "backup" ? "Backup request sent to active units." : operationFormOpen === "traffic" ? "Traffic stop started." : "Tow request created.");
      setOperationFormOpen("");
    }
  }

  function openRecord(record:any){
    setSelectedRecord(record);
  }

  async function openRecordById(recordId:string){
    setBusy("record");
    const response=await fetch(`/api/leo/records?communityId=${encodeURIComponent(communityId)}&id=${encodeURIComponent(recordId)}`);
    const body=await response.json();
    setBusy("");
    if(!response.ok){setMessage(body.error || "Unable to open record.");return;}
    setSelectedRecord(body.record);
  }

  async function openCharacterRecords(characterId:string){
    setCharacterRecordLoading(true);
    setMessage("");
    const response=await fetch(`/api/leo/character-records?communityId=${encodeURIComponent(communityId)}&characterId=${encodeURIComponent(characterId)}`);
    const body=await response.json();
    setCharacterRecordLoading(false);
    if(!response.ok){setMessage(body.error || "Unable to open player records.");return;}
    setSelectedCharacterRecord(body);
    setClearConfirmation("");
  }

  async function clearCharacterRecords(){
    if(!selectedCharacterRecord?.character?.id) return;
    setBusy("clear-character-records");
    setMessage("");
    const response=await fetch("/api/leo/character-records",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        action:"clear_all",communityId,characterId:selectedCharacterRecord.character.id,confirmation:clearConfirmation
      })
    });
    const body=await response.json();
    setBusy("");
    if(!response.ok){setMessage(body.error || "Unable to clear player records.");return;}
    const c=body.cleared || {};
    setMessage(`Player LEO records cleared: ${c.records||0} records, ${c.warrants||0} warrants, ${c.bookings||0} bookings, ${c.trafficStops||0} traffic stops.`);
    setSelectedCharacterRecord(null);
    setSearchResults([]);
    setQuery("");
    router.refresh();
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

  async function setCallStatus(callId:string,status:string){
    const ok=await api("/api/leo/calls",{action:"set_status",callId,status});
    if(ok) setMessage(status === "closed" ? "Call cleared and moved to history." : `Call marked ${status}.`);
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
    else if (action === "backup") { if (!activeShift) setMessage("Clock in before requesting backup."); else setOperationFormOpen("backup"); }
    else if (action === "traffic") { if (!activeShift) setMessage("Clock in before starting a traffic stop."); else setOperationFormOpen("traffic"); }
    else if (action === "tow") { if (!activeShift) setMessage("Clock in before requesting a tow."); else setOperationFormOpen("tow"); }
    else if (["report", "citation", "arrest"].includes(action)) { setRecordFormOpen(action); setSelectedCharges([]); setRecordSubject(null); }
    else if (action === "bolo") setMessage("BOLO management is available on the live BOLO board.");
    else if (action === "self") {
      if (!canSelfDispatch) setMessage("Supervisor self-dispatch permission required.");
      else setMessage("Choose an active call and select Self Dispatch.");
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
          <button className={styles.iconButton} onClick={()=>setPanicBoardOpen(true)} title="Active panics">
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
        <section className={styles.panicStrip} onClick={()=>setPanicBoardOpen(true)} role="button" tabIndex={0}>
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
          ["Reports Today", records.filter((r:any)=>r.record_type === "report" && new Date(r.created_at).toDateString() === new Date().toDateString()).length, BookOpenCheck, "#9d52ff"],
          ["Citations Today", records.filter((r:any)=>r.record_type === "citation" && new Date(r.created_at).toDateString() === new Date().toDateString()).length, Gavel, "#ff9f2d"],
          ["Arrests Today", records.filter((r:any)=>r.record_type === "arrest" && new Date(r.created_at).toDateString() === new Date().toDateString()).length, BadgeCheck, "#ff4949"],
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
                <div className={styles.callActions}>
                  {canSelfDispatch && activeShift && <button onClick={() => selfDispatch(call.id)}>Dispatch</button>}
                  {canManageCalls && <button onClick={()=>setCallStatus(call.id,"closed")}>Clear</button>}
                </div>
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
          <header><h2>Active Warrants</h2><span>{warrants.length} active</span></header>
          <div className={styles.placeholderRows}>{warrants.slice(0,5).map((w:any)=><article key={w.id}><span>{w.warrant_number}</span><b>{w.character ? `${w.character.first_name} ${w.character.last_name}` : w.title}</b><small>{w.priority}</small></article>)}{!warrants.length&&<div className={styles.emptyPanel}>No active warrants.</div>}</div>
        </div>

        <div className={`${styles.panel} ${styles.reportsPanel}`}>
          <header><h2>Recent Reports</h2><span>{records.filter((r:any)=>r.record_type==="report").length} loaded</span></header>
          <div className={styles.placeholderRows}>{records.filter((r:any)=>r.record_type==="report").slice(0,5).map((r:any)=><button type="button" className={styles.recordRow} key={r.id} onClick={()=>openRecord(r)}><span>{r.record_number}</span><b>{r.title}</b><small>{r.status}</small><ChevronRight/></button>)}{!records.some((r:any)=>r.record_type==="report")&&<div className={styles.emptyPanel}>No reports yet.</div>}</div>
        </div>

        <div className={`${styles.panel} ${styles.citationsPanel}`}>
          <header><h2>Recent Citations</h2><span>{records.filter((r:any)=>r.record_type==="citation").length} loaded</span></header>
          <div className={styles.placeholderRows}>{records.filter((r:any)=>r.record_type==="citation").slice(0,5).map((r:any)=><button type="button" className={styles.recordRow} key={r.id} onClick={()=>openRecord(r)}><span>{r.record_number}</span><b>{r.title}</b><small>${Number(r.total_fine||0).toFixed(0)}</small><ChevronRight/></button>)}{!records.some((r:any)=>r.record_type==="citation")&&<div className={styles.emptyPanel}>No citations yet.</div>}</div>
        </div>

        <div className={`${styles.panel} ${styles.arrestsPanel}`}>
          <header><h2>Recent Arrests</h2><span>{bookings.length} in custody</span></header>
          <div className={styles.placeholderRows}>{records.filter((r:any)=>r.record_type==="arrest").slice(0,5).map((r:any)=><button type="button" className={styles.recordRow} key={r.id} onClick={()=>openRecord(r)}><span>{r.record_number}</span><b>{r.title}</b><small>{r.total_jail_minutes||0} min</small><ChevronRight/></button>)}{!records.some((r:any)=>r.record_type==="arrest")&&<div className={styles.emptyPanel}>No arrests yet.</div>}</div>
        </div>

        <div className={`${styles.panel} ${styles.operationsPanel}`}>
          <header><h2>Active Operations</h2><span>{trafficStops.length + towRequests.length + backupRequests.length} live</span></header>
          <div className={styles.operationRows}>
            {backupRequests.slice(0,3).map((item:any)=><article key={item.id}><Siren/><div><b>Backup · {item.priority}</b><span>{item.location || "Location pending"}</span><small>{item.reason}</small></div></article>)}
            {trafficStops.slice(0,3).map((item:any)=><article key={item.id}><Car/><div><b>{item.stop_number}</b><span>{item.location}</span><small>{item.reason}</small></div></article>)}
            {towRequests.slice(0,3).map((item:any)=><article key={item.id}><MapPin/><div><b>{item.request_number}</b><span>{item.location}</span><small>{item.status} · {item.reason}</small></div></article>)}
            {!trafficStops.length && !towRequests.length && !backupRequests.length && <div className={styles.emptyPanel}>No active traffic, tow, or backup operations.</div>}
          </div>
        </div>

        <aside className={styles.panicCard} onClick={()=>panicAlerts.length && setPanicBoardOpen(true)}>
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
        <div className={`${styles.modalBackdrop} ${recordFormOpen ? styles.searchBackdrop : ""}`}>
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
                  <button
                    type="button"
                    className={styles.searchResultRow}
                    key={`${result.type}-${result.id}`}
                    onClick={() => {
                      if (recordFormOpen && ["character", "vehicle"].includes(result.type)) {
                        setRecordSubject(result);
                        setSearchOpen(false);
                        return;
                      }
                      if (result.type === "record") {
                        setSearchOpen(false);
                        void openRecordById(result.id);
                        return;
                      }
                      if (result.type === "character") {
                        setSearchOpen(false);
                        void openCharacterRecords(result.id);
                        return;
                      }
                      setMessage(`${result.title} selected. Open a report, citation, or arrest to attach this record.`);
                      setSearchOpen(false);
                    }}
                  >
                    <span>{result.type}</span>
                    <div>
                      <h3>{result.title}</h3>
                      <p>{result.subtitle}</p>
                    </div>
                    <small>{recordFormOpen && ["character", "vehicle"].includes(result.type) ? "Select" : "View"}</small>
                    <ChevronRight />
                  </button>
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
      {operationFormOpen && (
        <div className={`${styles.modalBackdrop} ${styles.priorityBackdrop}`}>
          <form className={`${styles.modal} ${styles.operationModal}`} onSubmit={submitOperation}>
            <header><div><span>FIELD OPERATIONS</span><h2>{operationFormOpen === "backup" ? "Request Backup" : operationFormOpen === "traffic" ? "Start Traffic Stop" : "Request Tow"}</h2></div><button type="button" onClick={()=>setOperationFormOpen("")}><X/></button></header>
            <label>Location / Postal<input name="location" required placeholder="Enter current location or postal" /></label>
            <label>{operationFormOpen === "traffic" ? "Reason for Stop" : operationFormOpen === "tow" ? "Tow / Impound Reason" : "Reason for Backup"}<textarea name="reason" required placeholder={operationFormOpen === "traffic" ? "Observed violation and reason for initiating the stop" : operationFormOpen === "tow" ? "Why the vehicle requires towing or impound" : "Why additional units are needed"} /></label>
            {operationFormOpen !== "traffic" && <label>Priority<select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="urgent">Urgent</option>{operationFormOpen === "backup" && <option value="emergency">Emergency</option>}</select></label>}
            <button className={styles.primaryButton} disabled={!!busy}>{operationFormOpen === "backup" ? "Send Backup Request" : operationFormOpen === "traffic" ? "Start Traffic Stop" : "Create Tow Request"}</button>
          </form>
        </div>
      )}

      {panicBoardOpen && (
        <div className={`${styles.modalBackdrop} ${styles.priorityBackdrop}`}>
          <section className={`${styles.modal} ${styles.panicBoard}`}>
            <header><div><span>EMERGENCY OPERATIONS</span><h2>Active Officer Panics</h2></div><button onClick={()=>setPanicBoardOpen(false)}><X/></button></header>
            <div className={styles.panicList}>
              {panicAlerts.map((alert:any)=>{
                const shift=Array.isArray(alert.unit)?alert.unit[0]:alert.unit;
                const unit=Array.isArray(shift?.unit)?shift.unit[0]:shift?.unit;
                const person=Array.isArray(unit?.user)?unit.user[0]:unit?.user;
                return <article key={alert.id}><Siren/><div><b>{unit?.callsign || unit?.identifier_name || "Officer"}</b><strong>{person?.display_name || person?.username || "Connected unit"}</strong><span>{alert.location || "Location not supplied"}</span><small>{alert.message} · {new Date(alert.activated_at).toLocaleString()}</small></div><button onClick={()=>resolvePanic(alert.id)} disabled={!!busy}>Clear Panic</button></article>
              })}
              {!panicAlerts.length && <div className={styles.emptyPanel}>No active officer panics.</div>}
            </div>
          </section>
        </div>
      )}

      {selectedCharacterRecord && (
        <div className={`${styles.modalBackdrop} ${styles.priorityBackdrop}`}>
          <section className={`${styles.modal} ${styles.characterRecordViewer}`}>
            <header>
              <div>
                <span>PLAYER RECORD MANAGEMENT</span>
                <h2>{selectedCharacterRecord.character.first_name} {selectedCharacterRecord.character.last_name}</h2>
                <p>State ID {selectedCharacterRecord.character.state_id} · {selectedCharacterRecord.character.is_archived ? "Archived character" : "Active character"}</p>
              </div>
              <button onClick={()=>setSelectedCharacterRecord(null)}><X/></button>
            </header>

            <div className={styles.characterRecordStats}>
              <article><span>LEO Records</span><b>{selectedCharacterRecord.records.length}</b></article>
              <article><span>Warrants</span><b>{selectedCharacterRecord.warrants.length}</b></article>
              <article><span>Bookings</span><b>{selectedCharacterRecord.bookings.length}</b></article>
              <article><span>Traffic Stops</span><b>{selectedCharacterRecord.trafficStops.length}</b></article>
            </div>

            <section className={styles.characterRecordsSection}>
              <header><h3>Reports, Citations & Arrests</h3><span>{selectedCharacterRecord.records.length} total</span></header>
              <div>
                {selectedCharacterRecord.records.map((record:any)=><button type="button" key={record.id} className={styles.recordRow} onClick={()=>{setSelectedCharacterRecord(null);void openRecordById(record.id)}}><span>{record.record_number}</span><b>{record.title}</b><small>{record.record_type} · {record.status}</small><ChevronRight/></button>)}
                {!selectedCharacterRecord.records.length && <div className={styles.emptyPanel}>No LEO reports, citations, or arrests on this player.</div>}
              </div>
            </section>

            {(selectedCharacterRecord.warrants.length>0 || selectedCharacterRecord.bookings.length>0 || selectedCharacterRecord.trafficStops.length>0) && <section className={styles.characterLinkedData}>
              {selectedCharacterRecord.warrants.length>0 && <div><h3>Warrants</h3>{selectedCharacterRecord.warrants.map((w:any)=><article key={w.id}><b>{w.warrant_number}</b><span>{w.title}</span><small>{w.status} · {w.priority}</small></article>)}</div>}
              {selectedCharacterRecord.bookings.length>0 && <div><h3>Bookings</h3>{selectedCharacterRecord.bookings.map((b:any)=><article key={b.id}><b>{b.booking_number}</b><span>{b.status}</span><small>{b.jail_minutes} min · ${Number(b.bond_amount||0).toFixed(0)} bond</small></article>)}</div>}
              {selectedCharacterRecord.trafficStops.length>0 && <div><h3>Traffic Stops</h3>{selectedCharacterRecord.trafficStops.map((t:any)=><article key={t.id}><b>{t.stop_number}</b><span>{t.location}</span><small>{t.status} · {t.reason}</small></article>)}</div>}
            </section>}

            {selectedCharacterRecord.canClear && <section className={styles.dangerZone}>
              <div><ShieldAlert/><div><b>Clear all LEO records</b><p>This permanently removes this character's reports, citations, arrests, warrants, bookings, traffic stops and LEO-only timeline entries. Civilian, DMV, banking, economy, business and vehicle data are preserved.</p></div></div>
              <label>Type <strong>CLEAR</strong> to confirm<input value={clearConfirmation} onChange={e=>setClearConfirmation(e.target.value)} placeholder="CLEAR" /></label>
              <button type="button" disabled={clearConfirmation.trim().toUpperCase()!=="CLEAR" || !!busy} onClick={clearCharacterRecords}>{busy==="clear-character-records"?"Clearing…":"Clear Player LEO Records"}</button>
            </section>}
          </section>
        </div>
      )}

      {selectedRecord && (
        <div className={`${styles.modalBackdrop} ${styles.priorityBackdrop}`}>
          <section className={`${styles.modal} ${styles.recordViewer}`}>
            <header><div><span>{String(selectedRecord.record_type).toUpperCase()} · {selectedRecord.record_number}</span><h2>{selectedRecord.title}</h2></div><button onClick={()=>setSelectedRecord(null)}><X/></button></header>
            <div className={styles.recordMeta}>
              <article><span>Status</span><b>{selectedRecord.status}</b></article>
              <article><span>Created</span><b>{new Date(selectedRecord.created_at).toLocaleString()}</b></article>
              <article><span>Location</span><b>{selectedRecord.location || "Not recorded"}</b></article>
              <article><span>Subject</span><b>{selectedRecord.character ? `${selectedRecord.character.first_name} ${selectedRecord.character.last_name}` : selectedRecord.vehicle ? `${selectedRecord.vehicle.plate_number} · ${selectedRecord.vehicle.make || ""} ${selectedRecord.vehicle.model || ""}` : "No subject attached"}</b></article>
              <article><span>Officer</span><b>{selectedRecord.officer ? `${selectedRecord.officer.callsign || ""} ${selectedRecord.officer.rank_name || ""} · ${selectedRecord.officer.badge_number || "No badge"}` : "Officer identity unavailable"}</b></article>
            </div>
            <section className={styles.narrativeBlock}><span>Officer Narrative</span><p>{selectedRecord.narrative || "No narrative recorded."}</p></section>
            {selectedRecord.charges?.length > 0 && <section className={styles.viewerCharges}><header>Attached Charges</header>{selectedRecord.charges.map((charge:any)=><article key={charge.id}><b>{charge.code}</b><span>{charge.title}</span><small>${Number(charge.fine_amount||0).toFixed(0)} · {charge.jail_minutes||0} min · {charge.points||0} pts</small></article>)}</section>}
            <div className={styles.recordTotals}><span>Fine <b>${Number(selectedRecord.total_fine||0).toFixed(0)}</b></span><span>Jail <b>{selectedRecord.total_jail_minutes||0} min</b></span><span>Points <b>{selectedRecord.total_points||0}</b></span><span>Bond <b>${Number(selectedRecord.bond_amount||0).toFixed(0)}</b></span></div>
          </section>
        </div>
      )}

      {recordFormOpen && (
        <div className={styles.modalBackdrop}>
          <form className={styles.modal} onSubmit={async (event)=>{event.preventDefault();const f=new FormData(event.currentTarget);const ok=await api("/api/leo/records",{action:"create_record",communityId,recordType:recordFormOpen,identifierId:selected?.id,title:f.get("title"),location:f.get("location"),narrative:f.get("narrative"),characterId:recordSubject?.type==="character"?recordSubject.id:null,vehicleId:recordSubject?.type==="vehicle"?recordSubject.id:null,charges:selectedCharges});if(ok){setRecordFormOpen("");setMessage(`${recordFormOpen} created successfully.`);}}}>
            <header><div><span>LEO RECORDS</span><h2>New {recordFormOpen}</h2></div><button type="button" onClick={()=>setRecordFormOpen("")}><X/></button></header>
            <div className={styles.formGrid}>
              <label className={styles.full}>Title<input name="title" required placeholder="Record title / primary incident" /></label>
              <label>Location<input name="location" placeholder="Location / postal" /></label>
              <label>Subject<div className={styles.subjectSelect}><input value={recordSubject?recordSubject.title:""} readOnly placeholder="Select character / vehicle" /><button type="button" onClick={()=>setSearchOpen(true)}>Search</button></div></label>
              <label className={styles.full}>Narrative<textarea name="narrative" required placeholder="Document the facts, observations, actions taken, and disposition." /></label>
              {(recordFormOpen==="citation"||recordFormOpen==="arrest")&&<div className={styles.full}><label>Penal code search<input value={penalQuery} onChange={e=>setPenalQuery(e.target.value)} placeholder="Search code, title, or category" /></label><div className={styles.chargePicker}>{penalCodes.filter((c:any)=>`${c.code} ${c.title} ${c.category}`.toLowerCase().includes(penalQuery.toLowerCase())).slice(0,8).map((c:any)=><button type="button" key={c.id} onClick={()=>setSelectedCharges((old:any[])=>old.some(x=>x.id===c.id)?old.filter(x=>x.id!==c.id):[...old,c])} className={selectedCharges.some((x:any)=>x.id===c.id)?styles.chargeSelected:""}><b>{c.code}</b><span>{c.title}</span><small>${Number(c.fine_amount).toFixed(0)} · {c.jail_minutes} min · {c.points} pts</small></button>)}</div></div>}
            </div>
            <button className={styles.primaryButton} disabled={!!busy}>Create {recordFormOpen}</button>
          </form>
        </div>
      )}

    </div>
  );
}
