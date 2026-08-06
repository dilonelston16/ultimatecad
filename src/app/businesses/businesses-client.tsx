"use client";

import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  Plus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./businesses.module.css";

export default function BusinessesClient({
  character,
  businesses,
}: any) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createBusiness(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/economy/businesses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        name: form.get("name"),
        businessType: form.get("businessType"),
        description: form.get("description"),
        address: form.get("address"),
        phone: form.get("phone"),
      }),
    });

    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error || "Business registration failed.");
      return;
    }

    setMessage("Business registered.");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span>Business centre</span>
          <h2>
            {businesses.length} business
            {businesses.length === 1 ? "" : "es"}
          </h2>
          <p>
            Manage ownership, business accounts, employees, payroll, and
            operating status.
          </p>
        </div>

        <button onClick={() => setOpen(!open)}>
          <Plus size={17} />
          Register business
        </button>
      </section>

      {message && <div className={styles.message}>{message}</div>}

      {open && (
        <form className={styles.form} onSubmit={createBusiness}>
          <header>
            <h3>Register a new business</h3>
            <p>
              A business number and operating bank account are generated
              automatically.
            </p>
          </header>

          <div>
            <label>
              Business name
              <input name="name" required />
            </label>

            <label>
              Business type
              <input
                name="businessType"
                required
                placeholder="Automotive, retail, legal..."
              />
            </label>

            <label>
              Address
              <input name="address" />
            </label>

            <label>
              Phone
              <input name="phone" />
            </label>

            <label className={styles.full}>
              Description
              <textarea name="description" />
            </label>
          </div>

          <button disabled={busy}>
            {busy ? "Registering…" : "Register business"}
          </button>
        </form>
      )}

      <section className={styles.grid}>
        {businesses.length ? (
          businesses.map((business: any) => {
            const account = Array.isArray(business.bank_account)
              ? business.bank_account[0]
              : business.bank_account;
            const members = business.members ?? [];

            return (
              <article key={business.id}>
                <header>
                  <div className={styles.icon}>
                    <Building2 />
                  </div>

                  <div>
                    <span>{business.business_type}</span>
                    <h3>{business.name}</h3>
                    <code>{business.business_number}</code>
                  </div>

                  <b className={styles[business.status] || styles.status}>
                    {business.status}
                  </b>
                </header>

                <p>{business.description || "No description provided."}</p>

                <dl>
                  <div>
                    <dt>Business account</dt>
                    <dd>{account?.account_number ?? "Not connected"}</dd>
                  </div>
                  <div>
                    <dt>Available balance</dt>
                    <dd>
                      $
                      {Number(
                        account?.available_balance ?? 0
                      ).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt>Employees</dt>
                    <dd>{members.length}</dd>
                  </div>
                  <div>
                    <dt>Address</dt>
                    <dd>{business.address || "—"}</dd>
                  </div>
                </dl>

                <div className={styles.summary}>
                  <span>
                    <Banknote />
                    Business banking connected
                  </span>
                  <span>
                    <Users />
                    Employee and payroll foundation active
                  </span>
                  <span>
                    <BriefcaseBusiness />
                    Owner and management record active
                  </span>
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.empty}>
            <BriefcaseBusiness size={44} />
            <h3>No businesses found</h3>
            <p>
              Register a business to create its operating account and owner
              record.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
