"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Plus,
  Send,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./businesses.module.css";

type Tab = "overview" | "banking" | "employees" | "payroll";

export default function BusinessesClient({ character, businesses }: any) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(businesses[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const selected = useMemo(
    () =>
      businesses.find((business: any) => business.id === selectedId) ??
      businesses[0] ??
      null,
    [businesses, selectedId]
  );

  async function callEmployee(payload: Record<string, unknown>) {
    setBusy(String(payload.memberId ?? payload.action ?? "employee"));
    setMessage("");

    const response = await fetch("/api/businesses/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error || "Employee action failed.");
      return false;
    }

    router.refresh();
    return true;
  }

  async function hire(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await callEmployee({
      businessId: selected.id,
      stateId: form.get("stateId"),
      roleName: form.get("roleName"),
      payType: form.get("payType"),
      payRate: form.get("payRate"),
    });
    if (ok) {
      setMessage("Employee hired.");
      event.currentTarget.reset();
    }
  }

  async function employeeAction(member: any, action: string) {
    if (action === "pay") {
      const amount = window.prompt("Payment amount:");
      if (!amount) return;
      const description =
        window.prompt("Payment description:", "Employee payment") ??
        "Employee payment";
      const ok = await callEmployee({
        action,
        memberId: member.id,
        amount,
        description,
      });
      if (ok) setMessage("Employee payment sent.");
      return;
    }

    let roleName: string | null = null;
    let payRate: string | null = null;
    let reason: string | null = null;

    if (action === "promote" || action === "demote") {
      roleName = window.prompt(
        `New role name for this ${action}:`,
        member.role_name
      );
      if (roleName === null) return;
      payRate = window.prompt(
        "New pay rate (leave unchanged by keeping current value):",
        String(member.pay_rate)
      );
    }

    if (action === "fire") {
      reason = window.prompt("Reason for firing this employee:") ?? "";
      if (!window.confirm("Fire this employee?")) return;
    }

    const ok = await callEmployee({
      action,
      memberId: member.id,
      roleName,
      payRate,
      reason,
    });
    if (ok) setMessage(`Employee ${action} completed.`);
  }

  async function businessTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("transfer");
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/businesses/banking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessId: selected.id,
        toAccountNumber: form.get("toAccountNumber"),
        amount: form.get("amount"),
        description: form.get("description"),
      }),
    });
    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error || "Business transfer failed.");
      return;
    }

    setMessage("Business transfer completed.");
    event.currentTarget.reset();
    router.refresh();
  }

  async function createPayroll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("payroll");
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/payroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessId: selected.id,
        payPeriodStart: form.get("payPeriodStart"),
        payPeriodEnd: form.get("payPeriodEnd"),
      }),
    });
    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error || "Payroll could not be created.");
      return;
    }

    setMessage("Payroll draft created.");
    router.refresh();
  }

  async function processPayroll(runId: string) {
    setBusy(runId);
    const response = await fetch("/api/payroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "process", payrollRunId: runId }),
    });
    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error || "Payroll could not be processed.");
      return;
    }

    setMessage("Payroll processed.");
    router.refresh();
  }

  if (!selected) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <BriefcaseBusiness size={44} />
          <h3>No business has been registered</h3>
          <p>Use the Register Business button on this page to create one.</p>
        </div>
      </div>
    );
  }

  const account = selected.bank_account;
  const employees = selected.members ?? [];
  const transactions = selected.transactions ?? [];
  const payrollRuns = selected.payrollRuns ?? [];

  return (
    <div className={styles.page}>
      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.selector}>
        <label>
          Business
          <select
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {businesses.map((business: any) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={styles.businessHeader}>
        <div className={styles.icon}>
          <Building2 />
        </div>
        <div>
          <span>{selected.business_type}</span>
          <h2>{selected.name}</h2>
          <code>{selected.business_number}</code>
        </div>
        <b className={styles[selected.status] ?? styles.status}>
          {selected.status}
        </b>
      </section>

      <nav className={styles.tabs}>
        {(["overview", "banking", "employees", "payroll"] as Tab[]).map(
          (item) => (
            <button
              key={item}
              className={tab === item ? styles.activeTab : ""}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          )
        )}
      </nav>

      {tab === "overview" && (
        <section className={styles.stats}>
          <article>
            <Banknote />
            <span>Available balance</span>
            <strong>
              ${Number(account?.available_balance ?? 0).toLocaleString()}
            </strong>
          </article>
          <article>
            <Users />
            <span>Active employees</span>
            <strong>
              {
                employees.filter(
                  (employee: any) => employee.status === "active"
                ).length
              }
            </strong>
          </article>
          <article>
            <CircleDollarSign />
            <span>Payroll runs</span>
            <strong>{payrollRuns.length}</strong>
          </article>
          <article>
            <BriefcaseBusiness />
            <span>Your access</span>
            <strong>
              {selected.owner_character_id === character.id
                ? "Owner"
                : "Employee"}
            </strong>
          </article>
        </section>
      )}

      {tab === "banking" && (
        <div className={styles.columns}>
          <section className={styles.panel}>
            <header>
              <h3>Business operating account</h3>
            </header>
            <dl className={styles.details}>
              <div>
                <dt>Account number</dt>
                <dd>{account?.account_number ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>Current balance</dt>
                <dd>${Number(account?.balance ?? 0).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Available balance</dt>
                <dd>
                  ${Number(account?.available_balance ?? 0).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{account?.status ?? "Unavailable"}</dd>
              </div>
            </dl>

            <form className={styles.compactForm} onSubmit={businessTransfer}>
              <input
                name="toAccountNumber"
                required
                placeholder="Receiving account number"
              />
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="Amount"
              />
              <input
                name="description"
                placeholder="Transfer description"
              />
              <button disabled={busy === "transfer"}>
                <Send size={15} />
                Transfer funds
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <header>
              <h3>Recent business transactions</h3>
            </header>
            <div className={styles.transactionList}>
              {transactions.length ? (
                transactions.map((transaction: any) => (
                  <article key={transaction.id}>
                    <div
                      className={
                        transaction.direction === "credit"
                          ? styles.credit
                          : styles.debit
                      }
                    >
                      {transaction.direction === "credit" ? (
                        <ArrowDownLeft />
                      ) : (
                        <ArrowUpRight />
                      )}
                    </div>
                    <div>
                      <b>{transaction.description}</b>
                      <span>
                        {transaction.transaction_type.replaceAll("_", " ")}
                      </span>
                      <code>{transaction.transaction_number}</code>
                    </div>
                    <strong>
                      {transaction.direction === "credit" ? "+" : "-"}$
                      {Number(transaction.amount).toLocaleString()}
                    </strong>
                  </article>
                ))
              ) : (
                <p>No business transactions yet.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "employees" && (
        <section className={styles.panel}>
          <header>
            <h3>Employees</h3>
          </header>

          <form className={styles.hireForm} onSubmit={hire}>
            <input name="stateId" required placeholder="Character State ID" />
            <input name="roleName" required placeholder="Starting role" />
            <select name="payType">
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
              <option value="commission">Commission</option>
            </select>
            <input
              name="payRate"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="Pay rate"
            />
            <button>
              <UserPlus size={15} />
              Hire
            </button>
          </form>

          <div className={styles.employeeGrid}>
            {employees.map((employee: any) => {
              const raw = employee.character;
              const person = Array.isArray(raw) ? raw[0] : raw;
              const isOwner =
                employee.character_id === selected.owner_character_id;

              return (
                <article key={employee.id}>
                  <div className={styles.employeeTop}>
                    <div>
                      <h3>
                        {person?.first_name} {person?.last_name}
                      </h3>
                      <code>{person?.state_id}</code>
                    </div>
                    <span>{employee.status}</span>
                  </div>

                  <dl>
                    <div>
                      <dt>Role</dt>
                      <dd>{employee.role_name}</dd>
                    </div>
                    <div>
                      <dt>Level</dt>
                      <dd>{employee.role_level ?? 1}</dd>
                    </div>
                    <div>
                      <dt>Pay type</dt>
                      <dd>{employee.pay_type}</dd>
                    </div>
                    <div>
                      <dt>Pay rate</dt>
                      <dd>${Number(employee.pay_rate).toLocaleString()}</dd>
                    </div>
                  </dl>

                  {!isOwner && (
                    <div className={styles.employeeActions}>
                      <button
                        onClick={() => employeeAction(employee, "promote")}
                      >
                        <ChevronUp size={14} />
                        Promote
                      </button>
                      <button
                        onClick={() => employeeAction(employee, "demote")}
                      >
                        <ChevronDown size={14} />
                        Demote
                      </button>
                      <button onClick={() => employeeAction(employee, "pay")}>
                        <CircleDollarSign size={14} />
                        Pay
                      </button>
                      {employee.status === "active" ? (
                        <button
                          className={styles.danger}
                          onClick={() => employeeAction(employee, "fire")}
                        >
                          <UserMinus size={14} />
                          Fire
                        </button>
                      ) : (
                        <button
                          onClick={() => employeeAction(employee, "rehire")}
                        >
                          <UserPlus size={14} />
                          Rehire
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "payroll" && (
        <section className={styles.panel}>
          <header>
            <h3>Payroll</h3>
          </header>

          <form className={styles.compactForm} onSubmit={createPayroll}>
            <input name="payPeriodStart" type="date" required />
            <input name="payPeriodEnd" type="date" required />
            <button disabled={busy === "payroll"}>
              <Plus size={15} />
              Create payroll
            </button>
          </form>

          <div className={styles.payrollList}>
            {payrollRuns.length ? (
              payrollRuns.map((run: any) => (
                <article key={run.id}>
                  <div>
                    <b>{run.payroll_number}</b>
                    <span>
                      {run.pay_period_start} to {run.pay_period_end}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Gross</dt>
                      <dd>${Number(run.gross_amount).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Tax</dt>
                      <dd>${Number(run.tax_amount).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Net</dt>
                      <dd>${Number(run.net_amount).toLocaleString()}</dd>
                    </div>
                  </dl>
                  <strong>{run.status}</strong>
                  {run.status === "draft" && (
                    <button
                      disabled={busy === run.id}
                      onClick={() => processPayroll(run.id)}
                    >
                      Process payroll
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p>No payroll runs have been created.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
