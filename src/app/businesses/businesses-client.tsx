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
  Package,
  Plus,
  Send,
  Store,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./businesses.module.css";

type Tab =
  | "overview"
  | "banking"
  | "employees"
  | "payroll"
  | "inventory"
  | "store";

export default function BusinessesClient({
  character,
  businesses,
  loadError = "",
}: any) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    businesses[0]?.id ?? ""
  );
  const [tab, setTab] = useState<Tab>("overview");
  const [message, setMessage] = useState(loadError);
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const selected = useMemo(
    () =>
      businesses.find(
        (business: any) => business.id === selectedId
      ) ??
      businesses[0] ??
      null,
    [businesses, selectedId]
  );

  async function request(url: string, payload: any) {
    setBusy(payload.action ?? url);
    setMessage("");

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error || "Action failed.");
      return false;
    }

    router.refresh();
    return true;
  }

  async function createBusiness(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const ok = await request("/api/economy/businesses", {
      characterId: character.id,
      name: form.get("name"),
      businessType: form.get("businessType"),
      address: form.get("address"),
      phone: form.get("phone"),
      description: form.get("description"),
    });

    if (ok) {
      setMessage("Business created.");
      setCreateOpen(false);
    }
  }

  async function callEmployee(payload: any) {
    const ok = await request(
      "/api/businesses/employees",
      payload
    );

    if (ok) {
      setMessage(`Employee ${payload.action || "hire"} completed.`);
    }
  }

  async function hire(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selected) return;

    const form = new FormData(event.currentTarget);

    const ok = await request("/api/businesses/employees", {
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

  async function employeeAction(
    employee: any,
    action: string
  ) {
    if (action === "pay") {
      const amount = window.prompt("Payment amount:");
      if (!amount) return;

      await callEmployee({
        action,
        memberId: employee.id,
        amount,
        description:
          window.prompt(
            "Payment description:",
            "Employee payment"
          ) || "Employee payment",
      });
      return;
    }

    let roleName: string | null = null;
    let payRate: string | null = null;
    let reason: string | null = null;

    if (action === "promote" || action === "demote") {
      roleName = window.prompt(
        "New role:",
        employee.role_name
      );
      if (roleName === null) return;

      payRate = window.prompt(
        "New pay rate:",
        String(employee.pay_rate)
      );
    }

    if (action === "fire") {
      reason =
        window.prompt("Reason for firing this employee:") || "";

      if (!window.confirm("Fire this employee?")) return;
    }

    await callEmployee({
      action,
      memberId: employee.id,
      roleName,
      payRate,
      reason,
    });
  }

  async function transfer(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selected) return;

    const form = new FormData(event.currentTarget);

    const ok = await request(
      "/api/businesses/banking",
      {
        businessId: selected.id,
        toAccountNumber: form.get("toAccountNumber"),
        amount: form.get("amount"),
        description: form.get("description"),
      }
    );

    if (ok) {
      setMessage("Business transfer completed.");
      event.currentTarget.reset();
    }
  }

  async function createPayroll(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selected) return;

    const form = new FormData(event.currentTarget);

    const ok = await request("/api/payroll", {
      businessId: selected.id,
      payPeriodStart: form.get("payPeriodStart"),
      payPeriodEnd: form.get("payPeriodEnd"),
    });

    if (ok) setMessage("Payroll draft created.");
  }

  async function processPayroll(runId: string) {
    const ok = await request("/api/payroll", {
      action: "process",
      payrollRunId: runId,
    });

    if (ok) setMessage("Payroll processed.");
  }

  async function publish(item: any) {
    if (!selected?.store) {
      setMessage(
        "This business does not have a storefront. Run the business repair migration."
      );
      return;
    }

    const price = window.prompt(
      "Retail price:",
      String(Math.max(Number(item.average_cost || 0), 1))
    );

    if (!price) return;

    const categories = selected.store.categories ?? [];

    if (!categories.length) {
      setMessage(
        "No store categories exist. Create a category in the Store tab first."
      );
      return;
    }

    const categoryNames = categories
      .map((category: any) => category.name)
      .join(", ");

    const chosen = window.prompt(
      `Category (${categoryNames}):`,
      categories[0]?.name || "General"
    );

    const category =
      categories.find(
        (entry: any) =>
          entry.name.toLowerCase() ===
          String(chosen || "").toLowerCase()
      ) ?? categories[0];

    const ok = await request("/api/businesses/store", {
      inventoryId: item.id,
      categoryId: category.id,
      price,
      description:
        window.prompt(
          "Product description:",
          item.item_name
        ) || item.item_name,
      active: true,
    });

    if (ok) setMessage("Item added to the business store.");
  }

  async function addCategory() {
    if (!selected?.store) return;

    const name = window.prompt("New category name:");
    if (!name) return;

    const ok = await request("/api/businesses/store", {
      action: "category",
      businessId: selected.id,
      storeId: selected.store.id,
      name,
    });

    if (ok) setMessage("Store category created.");
  }

  if (!selected) {
    return (
      <div className={styles.page}>
        {message && (
          <div className={styles.message}>{message}</div>
        )}

        <section className={styles.emptyState}>
          <BriefcaseBusiness size={44} />
          <h3>No businesses found</h3>
          <button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Register business
          </button>
        </section>

        {createOpen && (
          <form
            className={styles.createForm}
            onSubmit={createBusiness}
          >
            <h3>Register a business</h3>
            <div>
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Type
                <input name="businessType" required />
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
            <button>Create complete business</button>
          </form>
        )}
      </div>
    );
  }

  const account = selected.bank_account;
  const employees = selected.members ?? [];
  const transactions = selected.transactions ?? [];
  const payrollRuns = selected.payrollRuns ?? [];
  const inventory = selected.inventory ?? [];
  const products = selected.store?.products ?? [];

  return (
    <div className={styles.page}>
      {message && (
        <div className={styles.message}>{message}</div>
      )}

      <section className={styles.topActions}>
        <label>
          Business
          <select
            value={selected.id}
            onChange={(event) =>
              setSelectedId(event.target.value)
            }
          >
            {businesses.map((business: any) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
        </label>

        <button onClick={() => setCreateOpen(!createOpen)}>
          <Plus size={16} />
          Register business
        </button>
      </section>

      {createOpen && (
        <form
          className={styles.createForm}
          onSubmit={createBusiness}
        >
          <h3>Register a business</h3>
          <p>
            Creates the bank account, storefront, inventory, and
            categories.
          </p>
          <div>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Type
              <input name="businessType" required />
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
          <button>Create complete business</button>
        </form>
      )}

      <section className={styles.businessHeader}>
        <div className={styles.icon}>
          <Building2 />
        </div>
        <div>
          <span>{selected.business_type}</span>
          <h2>{selected.name}</h2>
          <code>{selected.business_number}</code>
        </div>
        <b>{selected.status}</b>
      </section>

      <nav className={styles.tabs}>
        {(
          [
            "overview",
            "banking",
            "employees",
            "payroll",
            "inventory",
            "store",
          ] as Tab[]
        ).map((item) => (
          <button
            key={item}
            className={
              tab === item ? styles.activeTab : ""
            }
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className={styles.stats}>
          <article>
            <Banknote />
            <span>Available balance</span>
            <strong>
              $
              {Number(
                account?.available_balance ?? 0
              ).toLocaleString()}
            </strong>
          </article>
          <article>
            <Users />
            <span>Employees</span>
            <strong>
              {
                employees.filter(
                  (employee: any) =>
                    employee.status === "active"
                ).length
              }
            </strong>
          </article>
          <article>
            <Package />
            <span>Inventory units</span>
            <strong>
              {inventory.reduce(
                (sum: number, item: any) =>
                  sum + Number(item.quantity || 0),
                0
              )}
            </strong>
          </article>
          <article>
            <Store />
            <span>Store products</span>
            <strong>{products.length}</strong>
          </article>
        </section>
      )}

      {tab === "banking" && (
        <div className={styles.columns}>
          <section className={styles.panel}>
            <header>
              <h3>Operating account</h3>
            </header>
            <dl className={styles.details}>
              <div>
                <dt>Account</dt>
                <dd>{account?.account_number ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd>
                  $
                  {Number(account?.balance ?? 0).toLocaleString()}
                </dd>
              </div>
            </dl>

            <form
              className={styles.compactForm}
              onSubmit={transfer}
            >
              <input
                name="toAccountNumber"
                required
                placeholder="Receiving account"
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
                placeholder="Description"
              />
              <button>
                <Send size={15} />
                Transfer
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <header>
              <h3>Transactions</h3>
            </header>
            <div className={styles.transactionList}>
              {transactions.map((transaction: any) => (
                <article key={transaction.id}>
                  {transaction.direction === "credit" ? (
                    <ArrowDownLeft />
                  ) : (
                    <ArrowUpRight />
                  )}
                  <div>
                    <b>{transaction.description}</b>
                    <span>
                      {transaction.transaction_type.replaceAll(
                        "_",
                        " "
                      )}
                    </span>
                  </div>
                  <strong>
                    {transaction.direction === "credit"
                      ? "+"
                      : "-"}
                    $
                    {Number(
                      transaction.amount
                    ).toLocaleString()}
                  </strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "employees" && (
        <section className={styles.panel}>
          <header>
            <h3>Employees</h3>
          </header>

          <form
            className={styles.hireForm}
            onSubmit={hire}
          >
            <input
              name="stateId"
              required
              placeholder="State ID"
            />
            <input
              name="roleName"
              required
              placeholder="Role"
            />
            <select name="payType">
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
              <option value="commission">Commission</option>
            </select>
            <input
              name="payRate"
              type="number"
              min="0"
              required
              placeholder="Pay"
            />
            <button>
              <UserPlus size={15} />
              Hire
            </button>
          </form>

          <div className={styles.employeeGrid}>
            {employees.map((employee: any) => {
              const rawPerson = employee.character;
              const person = Array.isArray(rawPerson)
                ? rawPerson[0]
                : rawPerson;
              const isOwner =
                employee.character_id ===
                selected.owner_character_id;

              return (
                <article key={employee.id}>
                  <h3>
                    {person?.first_name} {person?.last_name}
                  </h3>
                  <span>{employee.role_name}</span>

                  {!isOwner && (
                    <div className={styles.employeeActions}>
                      <button
                        onClick={() =>
                          employeeAction(
                            employee,
                            "promote"
                          )
                        }
                      >
                        <ChevronUp size={14} />
                        Promote
                      </button>
                      <button
                        onClick={() =>
                          employeeAction(
                            employee,
                            "demote"
                          )
                        }
                      >
                        <ChevronDown size={14} />
                        Demote
                      </button>
                      <button
                        onClick={() =>
                          employeeAction(employee, "pay")
                        }
                      >
                        <CircleDollarSign size={14} />
                        Pay
                      </button>
                      <button
                        onClick={() =>
                          employeeAction(employee, "fire")
                        }
                      >
                        <UserMinus size={14} />
                        Fire
                      </button>
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

          <form
            className={styles.compactForm}
            onSubmit={createPayroll}
          >
            <input
              name="payPeriodStart"
              type="date"
              required
            />
            <input
              name="payPeriodEnd"
              type="date"
              required
            />
            <button>
              <Plus size={15} />
              Create payroll
            </button>
          </form>

          <div className={styles.payrollList}>
            {payrollRuns.map((run: any) => (
              <article key={run.id}>
                <div>
                  <b>{run.payroll_number}</b>
                  <span>{run.status}</span>
                </div>
                <strong>
                  ${Number(run.net_amount).toLocaleString()}
                </strong>
                {run.status === "draft" && (
                  <button
                    onClick={() =>
                      processPayroll(run.id)
                    }
                  >
                    Process
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "inventory" && (
        <section className={styles.panel}>
          <header>
            <h3>Business inventory</h3>
            <p>
              Purchased business stock appears here and can be
              added to the storefront.
            </p>
          </header>

          <div className={styles.inventoryGrid}>
            {inventory.length ? (
              inventory.map((item: any) => {
                const product = Array.isArray(item.product)
                  ? item.product[0]
                  : item.product;

                return (
                  <article key={item.id}>
                    <Package />
                    <div>
                      <h3>{item.item_name}</h3>
                      <span>
                        {item.quantity -
                          item.reserved_quantity}{" "}
                        available · Cost $
                        {Number(
                          item.average_cost
                        ).toLocaleString()}
                      </span>
                      {product && (
                        <code>
                          {product.sku} · {product.category}
                        </code>
                      )}
                    </div>
                    <button onClick={() => publish(item)}>
                      Add to Store
                    </button>
                  </article>
                );
              })
            ) : (
              <p className={styles.emptyText}>
                No business inventory found. Complete a
                business purchase, then refresh this page.
              </p>
            )}
          </div>
        </section>
      )}

      {tab === "store" && (
        <section className={styles.panel}>
          <header className={styles.storePanelHeader}>
            <div>
              <h3>
                {selected.store?.name || "Business Store"}
              </h3>
              <p>
                Categories and products published from
                business inventory.
              </p>
            </div>
            <button onClick={addCategory}>
              <Plus size={15} />
              Add category
            </button>
          </header>

          <div className={styles.categoryPills}>
            {(selected.store?.categories ?? []).map(
              (category: any) => (
                <span key={category.id}>
                  {category.name}
                </span>
              )
            )}
          </div>

          <div className={styles.inventoryGrid}>
            {products.length ? (
              products.map((product: any) => (
                <article key={product.id}>
                  <Store />
                  <div>
                    <h3>{product.name}</h3>
                    <span>
                      {product.category} · $
                      {Number(product.price).toLocaleString()} ·
                      Stock {product.stock_quantity}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <p className={styles.emptyText}>
                No products published yet.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
