"use client";

import {
  FileJson,
  PackagePlus,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./store-catalog-admin.module.css";

const blankProduct = {
  id: "",
  sku: "",
  name: "",
  description: "",
  category: "General",
  product_type: "item",
  price: 0,
  stock_quantity: 0,
  active: true,
  restricted: false,
  asset_template: "{}",
};

export default function StoreCatalogAdminClient({
  communityId,
  stores,
}: any) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [product, setProduct] = useState<any>(blankProduct);
  const [bulkJson, setBulkJson] = useState("");
  const [busy, setBusy] = useState(false);

  const selected =
    stores.find((store: any) => store.id === storeId) ??
    stores[0] ??
    null;

  const products = selected?.products ?? [];

  const filtered = useMemo(() => {
    const query = search.toLowerCase();

    return products.filter((entry: any) =>
      [
        entry.name,
        entry.sku,
        entry.category,
        entry.product_type,
        entry.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [products, search]);

  function update(key: string, value: any) {
    setProduct((current: any) => ({
      ...current,
      [key]: value,
    }));
  }

  function edit(entry: any) {
    setProduct({
      ...entry,
      asset_template: JSON.stringify(entry.asset_template ?? {}, null, 2),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setProduct(blankProduct);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    let assetTemplate = {};

    try {
      assetTemplate = JSON.parse(product.asset_template || "{}");
    } catch {
      setBusy(false);
      setMessage("Asset template must be valid JSON.");
      return;
    }

    const response = await fetch("/api/stores/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeId: selected.id,
        productId: product.id || null,
        sku: product.sku,
        name: product.name,
        description: product.description,
        category: product.category,
        productType: product.product_type,
        price: product.price,
        stockQuantity: product.stock_quantity,
        active: product.active,
        restricted: product.restricted,
        assetTemplate,
      }),
    });

    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error || "Product could not be saved.");
      return;
    }

    setMessage(product.id ? "Product updated." : "Product created.");
    reset();
    router.refresh();
  }

  async function remove(entry: any) {
    const reason =
      window.prompt("Reason for removing this product:") ??
      "Removed by catalogue administrator.";

    if (!window.confirm(`Remove ${entry.name} from the catalogue?`)) return;

    const response = await fetch("/api/stores/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        productId: entry.id,
        reason,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setMessage(body.error || "Product could not be removed.");
      return;
    }

    setMessage("Product removed.");
    router.refresh();
  }

  async function importCatalog() {
    let catalog;

    try {
      catalog = JSON.parse(bulkJson);
    } catch {
      setMessage("Bulk catalogue must be valid JSON.");
      return;
    }

    const response = await fetch("/api/stores/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "bulk-import",
        communityId,
        catalog,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setMessage(body.error || "Bulk import failed.");
      return;
    }

    setMessage(
      `Bulk import finished: ${JSON.stringify(body.result)}`
    );
    router.refresh();
  }

  return (
    <div className={styles.page}>
      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.toolbar}>
        <label>
          Store
          <select
            value={selected?.id ?? ""}
            onChange={(event) => {
              setStoreId(event.target.value);
              reset();
            }}
          >
            {stores.map((store: any) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.search}>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
          />
        </div>
      </section>

      <div className={styles.columns}>
        <form className={styles.editor} onSubmit={save}>
          <header>
            <PackagePlus />
            <div>
              <h2>{product.id ? "Edit product" : "Create product"}</h2>
              <p>
                CAD staff and founders can create new store catalogue
                entries here.
              </p>
            </div>
          </header>

          <div className={styles.formGrid}>
            <label>
              SKU
              <input
                value={product.sku}
                onChange={(event) => update("sku", event.target.value)}
                required
              />
            </label>

            <label>
              Product name
              <input
                value={product.name}
                onChange={(event) => update("name", event.target.value)}
                required
              />
            </label>

            <label>
              Category
              <input
                value={product.category}
                onChange={(event) =>
                  update("category", event.target.value)
                }
                required
              />
            </label>

            <label>
              Product type
              <select
                value={product.product_type}
                onChange={(event) =>
                  update("product_type", event.target.value)
                }
              >
                <option value="item">Item</option>
                <option value="vehicle">Vehicle</option>
                <option value="weapon">Weapon</option>
                <option value="property">Property</option>
                <option value="service">Service</option>
                <option value="document">Document</option>
              </select>
            </label>

            <label>
              Price
              <input
                type="number"
                min="0"
                step="0.01"
                value={product.price}
                onChange={(event) => update("price", event.target.value)}
                required
              />
            </label>

            <label>
              Stock
              <input
                type="number"
                min="0"
                value={product.stock_quantity}
                onChange={(event) =>
                  update("stock_quantity", event.target.value)
                }
                required
              />
            </label>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={product.active}
                onChange={(event) =>
                  update("active", event.target.checked)
                }
              />
              Active
            </label>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={product.restricted}
                onChange={(event) =>
                  update("restricted", event.target.checked)
                }
              />
              Restricted
            </label>

            <label className={styles.full}>
              Description
              <textarea
                value={product.description}
                onChange={(event) =>
                  update("description", event.target.value)
                }
              />
            </label>

            <label className={styles.full}>
              Asset template JSON
              <textarea
                value={product.asset_template}
                onChange={(event) =>
                  update("asset_template", event.target.value)
                }
                spellCheck={false}
              />
            </label>
          </div>

          <div className={styles.editorActions}>
            <button disabled={busy}>
              {busy ? "Saving…" : "Save product"}
            </button>
            <button type="button" onClick={reset}>
              Clear
            </button>
          </div>
        </form>

        <section className={styles.importer}>
          <header>
            <FileJson />
            <div>
              <h2>Bulk catalogue import</h2>
              <p>
                Paste the included full-catalog.json file to add or
                update the complete structured catalogue.
              </p>
            </div>
          </header>

          <textarea
            value={bulkJson}
            onChange={(event) => setBulkJson(event.target.value)}
            placeholder='[{"store_name":"Ultimate General Store", ...}]'
            spellCheck={false}
          />

          <button onClick={importCatalog}>
            <Upload />
            Import catalogue
          </button>
        </section>
      </div>

      <section className={styles.productGrid}>
        {filtered.map((entry: any) => (
          <article key={entry.id}>
            <header>
              <div>
                <span>
                  {entry.category} · {entry.product_type}
                </span>
                <h3>{entry.name}</h3>
                <code>{entry.sku}</code>
              </div>
              <b>{entry.active ? "Active" : "Disabled"}</b>
            </header>

            <p>{entry.description || "No description."}</p>

            <dl>
              <div>
                <dt>Price</dt>
                <dd>${Number(entry.price).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Stock</dt>
                <dd>{entry.stock_quantity}</dd>
              </div>
              <div>
                <dt>Restricted</dt>
                <dd>{entry.restricted ? "Yes" : "No"}</dd>
              </div>
            </dl>

            <div className={styles.productActions}>
              <button onClick={() => edit(entry)}>
                <Pencil />
                Edit
              </button>
              <button onClick={() => remove(entry)}>
                <Trash2 />
                Remove
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
