"use client";

import {
  Boxes,
  Building2,
  Car,
  Home,
  Package,
  Shield,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./inventory.module.css";

export default function InventoryClient({
  items,
  vehicles,
  weapons,
  properties,
  businesses,
}: any) {
  const router = useRouter();
  const [tab, setTab] = useState("items");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const groups: any = {
    items,
    vehicles,
    weapons,
    properties,
    businesses,
  };

  const records = groups[tab] ?? [];

  const total = useMemo(
    () =>
      items.reduce(
        (sum: number, item: any) => sum + Number(item.quantity || 0),
        0
      ),
    [items]
  );

  async function useItem(item: any) {
    if (
      !window.confirm(
        `Use one ${item.item_name}? This will remove 1 from the quantity.`
      )
    ) {
      return;
    }

    setBusy(item.id);
    setMessage("");

    const response = await fetch("/api/inventory/use", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inventoryId: item.id }),
    });

    const body = await response.json();
    setBusy("");

    if (!response.ok) {
      setMessage(body.error || "The item could not be used.");
      return;
    }

    setMessage(`Used one ${item.item_name}.`);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.hero}>
        <div>
          <span>Owned assets</span>
          <h2>{total} inventory items</h2>
          <p>
            Identical purchases are combined into one item with a total
            quantity.
          </p>
        </div>
        <Boxes />
      </section>

      <nav className={styles.tabs}>
        {[
          ["items", "Items", Package],
          ["vehicles", "Vehicles", Car],
          ["weapons", "Weapons", Shield],
          ["properties", "Properties", Home],
          ["businesses", "Businesses", Building2],
        ].map(([id, label, Icon]: any) => (
          <button
            key={id}
            className={tab === id ? styles.active : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
            <span>{groups[id].length}</span>
          </button>
        ))}
      </nav>

      <section className={styles.grid}>
        {records.length ? (
          records.map((record: any) => {
            const product = Array.isArray(record.product)
              ? record.product[0]
              : record.product;

            const availableQuantity =
              Number(record.quantity || 0) -
              Number(record.listed_quantity || 0);

            return (
              <article key={record.id}>
                <header>
                  <div className={styles.icon}>
                    {tab === "items" ? (
                      <Package />
                    ) : tab === "vehicles" ? (
                      <Car />
                    ) : tab === "weapons" ? (
                      <Shield />
                    ) : tab === "properties" ? (
                      <Home />
                    ) : (
                      <Building2 />
                    )}
                  </div>

                  <div>
                    <span>
                      {product?.category ||
                        record.vehicle_type ||
                        record.weapon_type ||
                        record.property_type ||
                        record.business_type ||
                        tab}
                    </span>
                    <h3>
                      {record.item_name ||
                        `${record.model_year ?? ""} ${
                          record.make ?? ""
                        } ${record.model ?? ""}`.trim() ||
                        record.address ||
                        record.name}
                    </h3>
                    <code>
                      {record.plate_number ||
                        record.serial_number ||
                        record.property_number ||
                        record.business_number ||
                        product?.sku ||
                        ""}
                    </code>
                  </div>

                  <b>{record.status || "owned"}</b>
                </header>

                <dl>
                  {tab === "items" && (
                    <>
                      <div>
                        <dt>Total quantity</dt>
                        <dd>{record.quantity}</dd>
                      </div>
                      <div>
                        <dt>Available to use</dt>
                        <dd>{availableQuantity}</dd>
                      </div>
                      <div>
                        <dt>Marketplace listed</dt>
                        <dd>{record.listed_quantity ?? 0}</dd>
                      </div>
                    </>
                  )}

                  {tab === "vehicles" && (
                    <>
                      <div>
                        <dt>Plate</dt>
                        <dd>{record.plate_number}</dd>
                      </div>
                      <div>
                        <dt>VIN</dt>
                        <dd>{record.vin}</dd>
                      </div>
                    </>
                  )}

                  {tab === "weapons" && (
                    <>
                      <div>
                        <dt>Caliber</dt>
                        <dd>{record.caliber || "—"}</dd>
                      </div>
                      <div>
                        <dt>Registration</dt>
                        <dd>{record.registration_number}</dd>
                      </div>
                    </>
                  )}

                  {tab === "properties" && (
                    <>
                      <div>
                        <dt>Type</dt>
                        <dd>{record.property_type}</dd>
                      </div>
                      <div>
                        <dt>Garage spaces</dt>
                        <dd>{record.garage_spaces}</dd>
                      </div>
                    </>
                  )}

                  {tab === "businesses" && (
                    <>
                      <div>
                        <dt>Type</dt>
                        <dd>{record.business_type}</dd>
                      </div>
                      <div>
                        <dt>Number</dt>
                        <dd>{record.business_number}</dd>
                      </div>
                    </>
                  )}
                </dl>

                {tab === "items" && (
                  <button
                    className={styles.useButton}
                    disabled={
                      busy === record.id ||
                      availableQuantity <= 0 ||
                      record.status === "consumed"
                    }
                    onClick={() => useItem(record)}
                  >
                    <Package size={15} />
                    {busy === record.id ? "Using…" : "Use item"}
                  </button>
                )}
              </article>
            );
          })
        ) : (
          <div className={styles.empty}>
            <Package size={42} />
            <h3>No owned {tab}</h3>
            <p>Purchases and registered assets will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
