"use client";

import {
  Ban,
  CircleDollarSign,
  Eye,
  LockKeyhole,
  Search,
  ShieldAlert,
  Snowflake,
  Unlock,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./banking-admin.module.css";

export default function BankingAdminClient({ accounts, transactions, holds }: any) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? "");
  const [busy, setBusy] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((account: any) => {
      const character = Array.isArray(account.character) ? account.character[0] : account.character;
      const business = Array.isArray(account.business) ? account.business[0] : account.business;
      return [
        account.account_number, account.name, account.account_type, account.status,
        character?.first_name, character?.last_name, character?.state_id,
        business?.name, business?.business_number,
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [accounts, search]);

  const selected = accounts.find((account: any) => account.id === selectedId) ?? filtered[0] ?? null;
  const selectedTransactions = transactions.filter((item: any) => item.account_id === selected?.id);
  const selectedHolds = holds.filter((item: any) => item.account_id === selected?.id);

  async function action(payload: any) {
    setBusy(payload.action);
    setMessage("");
    const response = await fetch("/api/banking/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setBusy("");
    if (!response.ok) {
      setMessage(body.error || "Banking action failed.");
      return;
    }
    setMessage("Banking action completed.");
    router.refresh();
  }

  async function adjust(direction: "credit" | "debit") {
    if (!selected) return;
    const amount = window.prompt(`${direction === "credit" ? "Add" : "Remove"} amount:`);
    if (!amount) return;
    const reason = window.prompt("Reason for this balance adjustment:");
    if (!reason) return;
    await action({ action: "adjust", accountId: selected.id, direction, amount, reason });
  }

  async function status(status: string) {
    if (!selected) return;
    const reason = window.prompt(`Reason for setting this account to ${status}:`) ?? "";
    await action({ action: "status", accountId: selected.id, status, reason });
  }

  async function hold() {
    if (!selected) return;
    const amount = window.prompt("Amount to hold:");
    if (!amount) return;
    const reason = window.prompt("Reason for the hold:");
    if (!reason) return;
    await action({ action: "hold", accountId: selected.id, amount, reason });
  }

  const ownerName = (account: any) => {
    const character = Array.isArray(account.character) ? account.character[0] : account.character;
    const business = Array.isArray(account.business) ? account.business[0] : account.business;
    return business?.name || (character ? `${character.first_name} ${character.last_name}` : "System account");
  };

  return (
    <div className={styles.page}>
      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.search}>
        <Search size={18} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search account number, owner, State ID, business, type, or status..." />
      </section>

      <div className={styles.layout}>
        <section className={styles.accountList}>
          <header><h3>Accounts</h3><span>{filtered.length}</span></header>
          <div>
            {filtered.map((account: any) => (
              <button key={account.id} className={selected?.id === account.id ? styles.selected : ""}
                onClick={() => setSelectedId(account.id)}>
                <div><b>{ownerName(account)}</b><code>{account.account_number}</code></div>
                <span>{account.account_type}</span>
                <strong>${Number(account.available_balance).toLocaleString()}</strong>
                <em>{account.status}</em>
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <main className={styles.detail}>
            <section className={styles.summary}>
              <div><span>Account owner</span><h2>{ownerName(selected)}</h2><code>{selected.account_number}</code></div>
              <b className={styles[selected.status] || styles.status}>{selected.status}</b>
            </section>

            <section className={styles.stats}>
              <article><span>Current balance</span><strong>${Number(selected.balance).toLocaleString()}</strong></article>
              <article><span>Available balance</span><strong>${Number(selected.available_balance).toLocaleString()}</strong></article>
              <article><span>Active holds</span><strong>${selectedHolds.filter((h:any)=>h.status==="active").reduce((s:number,h:any)=>s+Number(h.amount),0).toLocaleString()}</strong></article>
              <article><span>Account type</span><strong>{selected.account_type}</strong></article>
            </section>

            <section className={styles.actions}>
              <button onClick={() => adjust("credit")}><CircleDollarSign /> Add money</button>
              <button onClick={() => adjust("debit")}><CircleDollarSign /> Remove money</button>
              <button onClick={() => status("frozen")}><Snowflake /> Freeze</button>
              <button onClick={() => status("restricted")}><LockKeyhole /> Restrict</button>
              <button onClick={() => status("active")}><Unlock /> Unfreeze</button>
              <button onClick={() => status("closed")}><Ban /> Close</button>
              <button onClick={hold}><ShieldAlert /> Place hold</button>
            </section>

            <section className={styles.panel}>
              <header><h3>Holds and seized funds</h3></header>
              <div className={styles.holds}>
                {selectedHolds.length ? selectedHolds.map((item:any)=>(
                  <article key={item.id}>
                    <div><b>${Number(item.amount).toLocaleString()}</b><span>{item.reason}</span><code>{item.status}</code></div>
                    {item.status==="active" && <div>
                      <button onClick={()=>action({action:"release",holdId:item.id})}>Release</button>
                      <button className={styles.danger} onClick={()=>action({action:"seize",holdId:item.id})}>Seize</button>
                    </div>}
                  </article>
                )) : <p>No holds on this account.</p>}
              </div>
            </section>

            <section className={styles.panel}>
              <header><h3>Account monitoring</h3><span>{selectedTransactions.length} recent entries</span></header>
              <div className={styles.transactions}>
                {selectedTransactions.length ? selectedTransactions.map((item:any)=>(
                  <article key={item.id}>
                    <Eye />
                    <div><b>{item.description}</b><span>{item.transaction_type.replaceAll("_"," ")} · {new Date(item.created_at).toLocaleString()}</span><code>{item.transaction_number}</code></div>
                    <strong className={item.direction==="credit"?styles.credit:styles.debit}>
                      {item.direction==="credit"?"+":"-"}${Number(item.amount).toLocaleString()}
                    </strong>
                  </article>
                )) : <p>No transactions for this account.</p>}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
