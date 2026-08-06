"use client";

import { Plus, ShieldCheck, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./insurance.module.css";

export default function InsuranceClient({ character, vehicles, policies }: any) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/insurance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        vehicleId: form.get("vehicleId"),
        providerName: form.get("providerName"),
        coverageType: form.get("coverageType"),
        premium: form.get("premium"),
        deductible: form.get("deductible"),
        coverageLimit: form.get("coverageLimit"),
        autoRenew: form.get("autoRenew") === "on",
        notes: form.get("notes"),
      }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(body.error || "Policy creation failed.");
    setMessage("Insurance policy created.");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div><span>Coverage centre</span><h2>{policies.filter((p:any)=>p.status==="active").length} active policies</h2><p>Protect registered vehicles and track coverage, premiums and expiry dates.</p></div>
        <button onClick={() => setOpen(!open)}><Plus size={17}/> New policy</button>
      </section>

      {message && <div className={styles.message}>{message}</div>}

      {open && (
        <form className={styles.form} onSubmit={submit}>
          <h3>Create vehicle policy</h3>
          <div>
            <label>Vehicle<select name="vehicleId" required><option value="">Select vehicle</option>{vehicles.map((v:any)=><option key={v.id} value={v.id}>{v.model_year} {v.make} {v.model} · {v.plate_number}</option>)}</select></label>
            <label>Provider<input name="providerName" required placeholder="Los Santos Mutual" /></label>
            <label>Coverage<select name="coverageType"><option value="liability">Liability</option><option value="collision">Collision</option><option value="comprehensive">Comprehensive</option><option value="full">Full coverage</option><option value="commercial">Commercial</option></select></label>
            <label>Premium<input name="premium" type="number" min="0" required /></label>
            <label>Deductible<input name="deductible" type="number" min="0" required /></label>
            <label>Coverage limit<input name="coverageLimit" type="number" min="0" /></label>
            <label className={styles.check}><input name="autoRenew" type="checkbox"/> Auto renew</label>
            <label className={styles.full}>Notes<textarea name="notes"/></label>
          </div>
          <button disabled={busy}>{busy ? "Creating…" : "Create policy"}</button>
        </form>
      )}

      <div className={styles.grid}>
        {policies.length ? policies.map((policy:any)=>{
          const vehicle=Array.isArray(policy.vehicle)?policy.vehicle[0]:policy.vehicle;
          return <article key={policy.id}>
            <header><div className={styles.icon}>{policy.status==="active"?<ShieldCheck/>:<ShieldX/>}</div><div><span>{policy.provider_name}</span><h3>{vehicle?.model_year} {vehicle?.make} {vehicle?.model}</h3><code>{policy.policy_number}</code></div><b className={styles[policy.status]||styles.status}>{policy.status}</b></header>
            <dl><div><dt>Plate</dt><dd>{vehicle?.plate_number}</dd></div><div><dt>Coverage</dt><dd>{policy.coverage_type}</dd></div><div><dt>Premium</dt><dd>${Number(policy.premium).toLocaleString()}</dd></div><div><dt>Deductible</dt><dd>${Number(policy.deductible).toLocaleString()}</dd></div><div><dt>Starts</dt><dd>{new Date(policy.starts_at).toLocaleDateString()}</dd></div><div><dt>Expires</dt><dd>{new Date(policy.expires_at).toLocaleDateString()}</dd></div></dl>
          </article>
        }):<div className={styles.empty}><ShieldX size={42}/><h3>No insurance policies</h3><p>Create coverage for a registered vehicle.</p></div>}
      </div>
    </div>
  );
}
