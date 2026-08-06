"use client";

import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  Plus,
  Store,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./businesses.module.css";

type Props = {
  character: any;
  businesses: any[];
  loadError?: string;
};

export default function BusinessesClient({
  character,
  businesses,
  loadError = "",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(loadError);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(
    businesses[0]?.id ?? ""
  );

  const selected = useMemo(
    () =>
      businesses.find((business) => business.id === selectedId) ??
      businesses[0] ??
      null,
    [businesses, selectedId]
  );

  async function createBusiness(
    event: React.FormEvent<HTMLFormElement>
  ) {
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
      setMessage(
        body.error || "Business registration could not be completed."
      );
      return;
    }

    setMessage("Business registered successfully.");
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
            Manage ownership, operating accounts, employees, stores,
            and payroll.
          </p>
        </div>

        <button onClick={() => setOpen((value) => !value)}>
          <Plus size={17} />
          Register business
        </button>
      </section>

      {message && (
        <div className={styles.message}>{message}</div>
      )}

      {open && (
        <form className={styles.form} onSubmit={createBusiness}>
          <header>
            <h3>Register a new business</h3>
            <p>
              The business number and operating account are generated
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

      {businesses.length > 1 && (
        <section className={styles.selector}>
          <label>
            Selected business
            <select
              value={selected?.id ?? ""}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {selected ? (
        <>
          <section className={styles.businessHeader}>
            <div className={styles.icon}>
              <Building2 />
            </div>

            <div>
              <span>{selected.business_type}</span>
              <h2>{selected.name}</h2>
              <code>{selected.business_number}</code>
            </div>

            <b
              className={
                styles[selected.status] ?? styles.status
              }
            >
              {selected.status}
            </b>
          </section>

          <section className={styles.stats}>
            <article>
              <Banknote />
              <span>Available balance</span>
              <strong>
                $
                {Number(
                  selected.bank_account?.available_balance ?? 0
                ).toLocaleString()}
              </strong>
            </article>

            <article>
              <Users />
              <span>Active employees</span>
              <strong>
                {(selected.members ?? []).filter(
                  (member: any) => member.status === "active"
                ).length}
              </strong>
            </article>

            <article>
              <Store />
              <span>Stores</span>
              <strong>{selected.stores?.length ?? 0}</strong>
            </article>

            <article>
              <BriefcaseBusiness />
              <span>Ownership</span>
              <strong>
                {selected.owner_character_id === character.id
                  ? "Owner"
                  : "Employee"}
              </strong>
            </article>
          </section>

          <div className={styles.columns}>
            <section className={styles.panel}>
              <header>
                <h3>Business details</h3>
              </header>

              <dl className={styles.details}>
                <div>
                  <dt>Operating account</dt>
                  <dd>
                    {selected.bank_account?.account_number ??
                      "Account repair required"}
                  </dd>
                </div>
                <div>
                  <dt>Account status</dt>
                  <dd>
                    {selected.bank_account?.status ?? "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{selected.address || "Not set"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{selected.phone || "Not set"}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.panel}>
              <header>
                <h3>Employees</h3>
              </header>

              <div className={styles.list}>
                {(selected.members ?? []).length ? (
                  selected.members.map((member: any) => {
                    const rawPerson = member.character;
                    const person = Array.isArray(rawPerson)
                      ? rawPerson[0]
                      : rawPerson;

                    return (
                      <article key={member.id}>
                        <div>
                          <b>
                            {person?.first_name} {person?.last_name}
                          </b>
                          <span>
                            {member.role_name} · {member.pay_type}
                          </span>
                          <code>{person?.state_id}</code>
                        </div>

                        <strong>
                          ${Number(member.pay_rate).toLocaleString()}
                        </strong>
                      </article>
                    );
                  })
                ) : (
                  <p>No employee records found.</p>
                )}
              </div>
            </section>
          </div>

          <section className={styles.panel}>
            <header>
              <h3>Stores</h3>
            </header>

            <div className={styles.storeGrid}>
              {(selected.stores ?? []).length ? (
                selected.stores.map((store: any) => (
                  <article key={store.id}>
                    <Store />
                    <div>
                      <b>{store.name}</b>
                      <span>
                        {store.description || "No description"}
                      </span>
                    </div>
                    <strong>{store.status}</strong>
                  </article>
                ))
              ) : (
                <p>No stores have been created for this business.</p>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className={styles.empty}>
          <BriefcaseBusiness size={44} />
          <h3>No businesses found</h3>
          <p>
            Register a business to create its ownership record and
            operating bank account.
          </p>
        </div>
      )}
    </div>
  );
}
