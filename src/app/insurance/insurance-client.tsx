"use client";

import {
  Car,
  Check,
  CircleDollarSign,
  Plus,
  ShieldCheck,
  ShieldX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./insurance.module.css";

export default function InsuranceClient({
  character,
  vehicles,
  policies,
  plans,
}: any) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(
    plans.find((plan: any) => plan.code === "FULL")?.id ?? plans[0]?.id ?? ""
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedPlan = useMemo(
    () => plans.find((plan: any) => plan.id === selectedPlanId),
    [plans, selectedPlanId]
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/insurance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        vehicleId: form.get("vehicleId"),
        planPresetId: selectedPlanId,
        providerName: form.get("providerName"),
        autoRenew: form.get("autoRenew") === "on",
        notes: form.get("notes"),
      }),
    });

    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error || "Policy creation failed.");
      return;
    }

    setMessage("Insurance policy created.");
    setOpen(false);
    router.refresh();
  }

  async function updateStatus(policyId: string, status: string) {
    const reason =
      window.prompt(`Reason for changing this policy to ${status}:`) ?? "";

    const response = await fetch("/api/insurance/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ policyId, status, reason }),
    });

    const body = await response.json();

    if (!response.ok) {
      setMessage(body.error || "Policy update failed.");
      return;
    }

    router.refresh();
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span>Coverage centre</span>
          <h2>
            {policies.filter((policy: any) => policy.status === "active").length}{" "}
            active policies
          </h2>
          <p>
            Choose a preset protection plan instead of manually entering policy
            values.
          </p>
        </div>

        <button onClick={() => setOpen(!open)}>
          {open ? <X size={17} /> : <Plus size={17} />}
          {open ? "Close" : "New policy"}
        </button>
      </section>

      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.explainer}>
        <article>
          <CircleDollarSign />
          <div>
            <h3>Premium</h3>
            <p>
              The amount charged for the policy. This will later be taken from
              the character’s bank account when banking is connected.
            </p>
          </div>
        </article>

        <article>
          <ShieldX />
          <div>
            <h3>Deductible</h3>
            <p>
              The amount the character must pay on an approved claim before
              insurance covers the remaining eligible damage.
            </p>
          </div>
        </article>

        <article>
          <ShieldCheck />
          <div>
            <h3>Coverage limit</h3>
            <p>
              The maximum total amount the policy can pay for a covered claim.
              Damage above this amount remains the owner’s responsibility.
            </p>
          </div>
        </article>
      </section>

      {open && (
        <form className={styles.form} onSubmit={submit}>
          <header>
            <h3>Create vehicle policy</h3>
            <p>Select a plan. Its premium, deductible and limit are automatic.</p>
          </header>

          <label>
            Vehicle
            <select name="vehicleId" required>
              <option value="">Select vehicle</option>
              {vehicles.map((vehicle: any) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.model_year} {vehicle.make} {vehicle.model} ·{" "}
                  {vehicle.plate_number}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.planGrid}>
            {plans.map((plan: any) => (
              <button
                type="button"
                key={plan.id}
                className={selectedPlanId === plan.id ? styles.selectedPlan : ""}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <div>
                  <span>{plan.name}</span>
                  {selectedPlanId === plan.id && <Check size={17} />}
                </div>
                <p>{plan.description}</p>
                <dl>
                  <div>
                    <dt>Premium</dt>
                    <dd>${Number(plan.premium).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Deductible</dt>
                    <dd>${Number(plan.deductible).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Limit</dt>
                    <dd>${Number(plan.coverage_limit).toLocaleString()}</dd>
                  </div>
                </dl>
              </button>
            ))}
          </div>

          {selectedPlan && (
            <div className={styles.coverageSummary}>
              <h4>{selectedPlan.name} includes</h4>
              <div>
                <span className={selectedPlan.liability_covered ? styles.yes : styles.no}>
                  {selectedPlan.liability_covered ? <Check /> : <X />} Liability
                </span>
                <span className={selectedPlan.collision_covered ? styles.yes : styles.no}>
                  {selectedPlan.collision_covered ? <Check /> : <X />} Collision
                </span>
                <span className={selectedPlan.theft_covered ? styles.yes : styles.no}>
                  {selectedPlan.theft_covered ? <Check /> : <X />} Theft
                </span>
                <span className={selectedPlan.fire_covered ? styles.yes : styles.no}>
                  {selectedPlan.fire_covered ? <Check /> : <X />} Fire
                </span>
              </div>
            </div>
          )}

          <div className={styles.formGrid}>
            <label>
              Provider
              <input
                name="providerName"
                defaultValue="Los Santos Mutual"
                required
              />
            </label>

            <label className={styles.check}>
              <input name="autoRenew" type="checkbox" />
              Auto renew
            </label>

            <label className={styles.full}>
              Notes
              <textarea name="notes" />
            </label>
          </div>

          <button disabled={busy || !selectedPlanId}>
            {busy ? "Creating…" : "Create policy"}
          </button>
        </form>
      )}

      <div className={styles.grid}>
        {policies.length ? (
          policies.map((policy: any) => {
            const vehicle = Array.isArray(policy.vehicle)
              ? policy.vehicle[0]
              : policy.vehicle;
            const plan = Array.isArray(policy.plan)
              ? policy.plan[0]
              : policy.plan;

            return (
              <article key={policy.id}>
                <header>
                  <div className={styles.icon}>
                    {policy.status === "active" ? (
                      <ShieldCheck />
                    ) : (
                      <ShieldX />
                    )}
                  </div>

                  <div>
                    <span>{plan?.name ?? policy.provider_name}</span>
                    <h3>
                      {vehicle?.model_year} {vehicle?.make} {vehicle?.model}
                    </h3>
                    <code>{policy.policy_number}</code>
                  </div>

                  <b className={styles[policy.status] || styles.status}>
                    {policy.status}
                  </b>
                </header>

                <dl>
                  <div>
                    <dt>Plate</dt>
                    <dd>{vehicle?.plate_number}</dd>
                  </div>
                  <div>
                    <dt>Premium</dt>
                    <dd>${Number(policy.premium).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Deductible</dt>
                    <dd>${Number(policy.deductible).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Coverage limit</dt>
                    <dd>${Number(policy.coverage_limit).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Starts</dt>
                    <dd>{new Date(policy.starts_at).toLocaleDateString()}</dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{new Date(policy.expires_at).toLocaleDateString()}</dd>
                  </div>
                </dl>

                <div className={styles.policyActions}>
                  {policy.status === "active" ? (
                    <>
                      <button
                        onClick={() =>
                          updateStatus(policy.id, "suspended")
                        }
                      >
                        Suspend
                      </button>
                      <button
                        onClick={() =>
                          updateStatus(policy.id, "cancelled")
                        }
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => updateStatus(policy.id, "active")}
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.empty}>
            <ShieldX size={42} />
            <h3>No insurance policies</h3>
            <p>Create coverage for a registered vehicle.</p>
          </div>
        )}
      </div>
    </div>
  );
}
