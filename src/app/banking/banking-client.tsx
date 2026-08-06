"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Landmark,
  Plus,
  Send,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./banking.module.css";

export default function BankingClient({
  character,
  accounts,
  transactions,
}: any) {
  const router = useRouter();
  const [openAccount, setOpenAccount] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const totalBalance = useMemo(
    () =>
      accounts.reduce(
        (sum: number, account: any) => sum + Number(account.balance || 0),
        0
      ),
    [accounts]
  );

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/banking/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        accountType: form.get("accountType"),
        name: form.get("name"),
      }),
    });

    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error || "Account creation failed.");
      return;
    }

    setMessage("Bank account opened.");
    setOpenAccount(false);
    router.refresh();
  }

  async function transfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/banking/transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fromAccountId: form.get("fromAccountId"),
        toAccountNumber: form.get("toAccountNumber"),
        amount: form.get("amount"),
        description: form.get("description"),
      }),
    });

    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error || "Transfer failed.");
      return;
    }

    setMessage("Transfer completed.");
    setOpenTransfer(false);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span>Personal banking</span>
          <h2>${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          <p>Total balance across all open accounts.</p>
        </div>

        <div className={styles.heroActions}>
          <button onClick={() => setOpenAccount(!openAccount)}>
            <Plus size={17} />
            Open account
          </button>
          <button onClick={() => setOpenTransfer(!openTransfer)}>
            <Send size={17} />
            Transfer
          </button>
        </div>
      </section>

      {message && <div className={styles.message}>{message}</div>}

      {openAccount && (
        <form className={styles.form} onSubmit={createAccount}>
          <header>
            <h3>Open a bank account</h3>
            <p>Checking accounts are for everyday payments. Savings accounts are for stored funds.</p>
          </header>

          <div className={styles.formGrid}>
            <label>
              Account type
              <select name="accountType" required>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </label>

            <label>
              Account name
              <input name="name" placeholder="Optional custom name" />
            </label>
          </div>

          <button disabled={busy}>
            {busy ? "Opening…" : "Open account"}
          </button>
        </form>
      )}

      {openTransfer && (
        <form className={styles.form} onSubmit={transfer}>
          <header>
            <h3>Transfer money</h3>
            <p>Transfers post immediately to both accounts.</p>
          </header>

          <div className={styles.formGrid}>
            <label>
              From account
              <select name="fromAccountId" required>
                <option value="">Select account</option>
                {accounts
                  .filter((account: any) => account.status === "active")
                  .map((account: any) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.account_number}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Receiving account number
              <input name="toAccountNumber" required />
            </label>

            <label>
              Amount
              <input name="amount" type="number" min="0.01" step="0.01" required />
            </label>

            <label>
              Description
              <input name="description" placeholder="Account transfer" />
            </label>
          </div>

          <button disabled={busy}>
            {busy ? "Sending…" : "Complete transfer"}
          </button>
        </form>
      )}

      <section className={styles.accountGrid}>
        {accounts.length ? (
          accounts.map((account: any) => (
            <article key={account.id}>
              <header>
                <div className={styles.accountIcon}>
                  {account.account_type === "savings" ? (
                    <Landmark />
                  ) : (
                    <WalletCards />
                  )}
                </div>

                <div>
                  <span>{account.account_type}</span>
                  <h3>{account.name}</h3>
                  <code>{account.account_number}</code>
                </div>

                <b className={styles[account.status] || styles.status}>
                  {account.status}
                </b>
              </header>

              <div className={styles.balance}>
                <span>Available balance</span>
                <strong>
                  ${Number(account.available_balance).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </strong>
              </div>

              <dl>
                <div>
                  <dt>Current balance</dt>
                  <dd>
                    ${Number(account.balance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </dd>
                </div>
                <div>
                  <dt>Overdraft</dt>
                  <dd>${Number(account.overdraft_limit).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Opened</dt>
                  <dd>{new Date(account.opened_at).toLocaleDateString()}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <div className={styles.empty}>
            <Building2 size={42} />
            <h3>No bank accounts</h3>
            <p>Open a checking or savings account to begin using the economy.</p>
          </div>
        )}
      </section>

      <section className={styles.transactions}>
        <header>
          <div>
            <span>Account activity</span>
            <h2>Recent transactions</h2>
          </div>
        </header>

        <div>
          {transactions.length ? (
            transactions.map((transaction: any) => (
              <article key={transaction.id}>
                <div
                  className={`${styles.transactionIcon} ${
                    transaction.direction === "credit"
                      ? styles.credit
                      : styles.debit
                  }`}
                >
                  {transaction.direction === "credit" ? (
                    <ArrowDownLeft />
                  ) : (
                    <ArrowUpRight />
                  )}
                </div>

                <div className={styles.transactionCopy}>
                  <b>{transaction.description}</b>
                  <span>
                    {transaction.transaction_type.replaceAll("_", " ")} ·{" "}
                    {new Date(transaction.created_at).toLocaleString()}
                  </span>
                  <code>{transaction.transaction_number}</code>
                </div>

                <div className={styles.transactionAmount}>
                  <strong>
                    {transaction.direction === "credit" ? "+" : "-"}$
                    {Number(transaction.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                  <span>
                    Balance ${Number(transaction.balance_after).toLocaleString()}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className={styles.emptySmall}>
              No transactions have been posted.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
