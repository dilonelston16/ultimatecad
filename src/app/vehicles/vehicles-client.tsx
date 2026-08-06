"use client";

import { Car, CircleAlert, FileCheck2, Plus, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./vehicles.module.css";

export default function VehiclesClient({ character, vehicles, transfers }: any) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submitVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        make: form.get("make"),
        model: form.get("model"),
        modelYear: form.get("modelYear"),
        color: form.get("color"),
        secondaryColor: form.get("secondaryColor"),
        vehicleType: form.get("vehicleType"),
        bodyStyle: form.get("bodyStyle"),
        plateNumber: form.get("plateNumber"),
        purchasePrice: form.get("purchasePrice"),
        financed: form.get("financed") === "on",
        lienholder: form.get("lienholder"),
        notes: form.get("notes"),
      }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(body.error || "Registration failed.");
    setMessage("Vehicle registered successfully.");
    setShowCreate(false);
    router.refresh();
  }

  async function setStatus(vehicleId: string, status: string) {
    const reason = window.prompt(`Reason for marking this vehicle ${status}:`) || "";
    const response = await fetch("/api/vehicles/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId, status, reason }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Status update failed.");
    router.refresh();
  }

  async function transfer(vehicleId: string) {
    const toStateId = window.prompt("Receiving character State ID:");
    if (!toStateId) return;
    const salePrice = window.prompt("Sale price (optional):") || "";
    const response = await fetch("/api/vehicles/transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId, toStateId, salePrice }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Transfer request failed.");
    setMessage("Ownership transfer request created.");
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span>Vehicle registry</span>
          <h2>{vehicles.length} registered vehicle{vehicles.length === 1 ? "" : "s"}</h2>
          <p>Manage registration, insurance, ownership and vehicle status.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}>
          <Plus size={17} /> Register vehicle
        </button>
      </section>

      {message && <div className={styles.message}>{message}</div>}

      {showCreate && (
        <form className={styles.form} onSubmit={submitVehicle}>
          <header><h3>New vehicle registration</h3><p>VIN and registration numbers are generated automatically.</p></header>
          <div className={styles.formGrid}>
            <label>Make<input name="make" required placeholder="Bravado" /></label>
            <label>Model<input name="model" required placeholder="Buffalo STX" /></label>
            <label>Year<input name="modelYear" type="number" min="1900" max="2100" required /></label>
            <label>Primary colour<input name="color" required placeholder="Black" /></label>
            <label>Secondary colour<input name="secondaryColor" placeholder="Optional" /></label>
            <label>Vehicle type<select name="vehicleType"><option value="car">Car</option><option value="truck">Truck</option><option value="motorcycle">Motorcycle</option><option value="commercial">Commercial</option><option value="boat">Boat</option><option value="aircraft">Aircraft</option><option value="other">Other</option></select></label>
            <label>Body style<input name="bodyStyle" placeholder="Sedan, SUV, coupe..." /></label>
            <label>Custom plate<input name="plateNumber" placeholder="Leave blank for automatic" /></label>
            <label>Purchase price<input name="purchasePrice" type="number" min="0" /></label>
            <label>Lienholder<input name="lienholder" placeholder="Bank or finance company" /></label>
            <label className={styles.checkbox}><input name="financed" type="checkbox" /> Financed vehicle</label>
            <label className={styles.full}>Notes<textarea name="notes" /></label>
          </div>
          <button disabled={busy}>{busy ? "Registering…" : "Complete registration"}</button>
        </form>
      )}

      <div className={styles.grid}>
        {vehicles.length ? vehicles.map((vehicle: any) => {
          const policy = vehicle.insurance_policies?.find((item: any) => item.status === "active");
          return (
            <article className={styles.card} key={vehicle.id}>
              <div className={styles.cardTop}>
                <div className={styles.icon}><Car /></div>
                <div><span>{vehicle.model_year} {vehicle.make}</span><h3>{vehicle.model}</h3><code>{vehicle.plate_number}</code></div>
                <b className={`${styles.status} ${styles[vehicle.status] || ""}`}>{vehicle.status}</b>
              </div>
              <dl>
                <div><dt>VIN</dt><dd>{vehicle.vin}</dd></div>
                <div><dt>Registration</dt><dd>{vehicle.registration_number}</dd></div>
                <div><dt>Expires</dt><dd>{new Date(vehicle.registration_expires_at).toLocaleDateString()}</dd></div>
                <div><dt>Insurance</dt><dd>{policy ? policy.policy_number : "Not insured"}</dd></div>
              </dl>
              <div className={styles.actions}>
                {vehicle.status !== "stolen" ? (
                  <button onClick={() => setStatus(vehicle.id, "stolen")}><CircleAlert size={15}/> Report stolen</button>
                ) : (
                  <button onClick={() => setStatus(vehicle.id, "recovered")}><RefreshCcw size={15}/> Mark recovered</button>
                )}
                <button onClick={() => transfer(vehicle.id)}><Send size={15}/> Transfer</button>
                <a href="/insurance"><ShieldCheck size={15}/> Insurance</a>
              </div>
            </article>
          );
        }) : (
          <div className={styles.empty}><Car size={40}/><h3>No registered vehicles</h3><p>Register your first vehicle to generate a VIN, plate and registration record.</p></div>
        )}
      </div>

      {transfers.length > 0 && (
        <section className={styles.transferPanel}>
          <h3>Ownership transfer requests</h3>
          {transfers.map((transfer: any) => {
            const to = Array.isArray(transfer.to_character) ? transfer.to_character[0] : transfer.to_character;
            return <div key={transfer.id}><FileCheck2/><span>Transfer to {to?.first_name} {to?.last_name} ({to?.state_id})</span><b>{transfer.status}</b></div>;
          })}
        </section>
      )}
    </div>
  );
}
