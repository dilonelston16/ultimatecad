"use client";

import { Building2, Car, ChevronDown, Home, Package, RefreshCcw, Search, Shield, ShoppingCart, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./stores.module.css";

export default function StoresClient({character,stores,accounts,canRestock}:any){
  const router=useRouter();
  const [storeType,setStoreType]=useState("all");
  const [storeId,setStoreId]=useState(stores[0]?.id??"");
  const [category,setCategory]=useState("all");
  const [search,setSearch]=useState("");
  const [accountId,setAccountId]=useState(accounts[0]?.id??"");
  const [message,setMessage]=useState("");

  const visibleStores=stores.filter((s:any)=>storeType==="all"||s.store_type===storeType);
  const selected=visibleStores.find((s:any)=>s.id===storeId)||visibleStores[0]||null;
  const products=selected?.products??[];
  const categories=Array.from(new Set(products.map((p:any)=>p.category||"Other"))).sort() as string[];
  const filtered=useMemo(()=>products.filter((p:any)=>(category==="all"||(p.category||"Other")===category)&&[p.name,p.sku,p.description,p.category,p.product_type].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())),[products,category,search]);

  async function buy(product:any){
    if(!accountId)return setMessage("Select a bank account.");
    const qty=product.product_type==="item"?Number(window.prompt("Quantity:","1")||0):1;
    if(!qty)return;
    const response=await fetch("/api/stores/purchase",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({characterId:character.id,accountId,productId:product.id,quantity:qty})});
    const body=await response.json();
    if(!response.ok)return setMessage(body.error||"Purchase failed.");
    setMessage(`${product.name} purchased. Check Inventory & Assets.`);
    router.refresh();
  }

  async function restock(product:any){
    const quantity=Number(window.prompt("Restock quantity:","25")||0);
    if(!quantity)return;
    const reason=window.prompt("Restock reason:","Founder catalogue restock")||"Manual restock";
    const response=await fetch("/api/stores/restock",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({productId:product.id,quantity,reason})});
    const body=await response.json();
    if(!response.ok)return setMessage(body.error||"Restock failed.");
    setMessage(`${product.name} restocked.`);
    router.refresh();
  }

  function icon(type:string){return type==="vehicle"?<Car/>:type==="weapon"?<Shield/>:type==="property"?<Home/>:<Package/>}

  return <div className={styles.page}>
    {message&&<div className={styles.message}>{message}</div>}
    <section className={styles.hero}><div><span>Community marketplace stores</span><h2>{stores.length} active storefronts</h2><p>Browse government catalogues, general supplies, and stores owned by community businesses.</p></div><Store/></section>
    <section className={styles.filters}>
      <label>Store group<select value={storeType} onChange={e=>{setStoreType(e.target.value);setStoreId("");setCategory("all")}}><option value="all">All stores</option><option value="government">Government</option><option value="general">General stores</option><option value="business">Business stores</option></select></label>
      <label>Store<select value={selected?.id??""} onChange={e=>{setStoreId(e.target.value);setCategory("all")}}>{visibleStores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
      <label>Pay from<select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Select account</option>{accounts.map((a:any)=><option key={a.id} value={a.id}>{a.name} · ${Number(a.available_balance).toLocaleString()}</option>)}</select></label>
      <div className={styles.search}><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products..."/></div>
    </section>
    {selected&&<section className={styles.storeHeader}><div>{selected.store_type==="business"?<Building2/>:<Store/>}</div><div><span>{selected.category_group} · {selected.store_type}</span><h2>{selected.name}</h2><p>{selected.description}</p>{selected.business&&<code>Owned by {Array.isArray(selected.business)?selected.business[0]?.name:selected.business.name}</code>}</div><b>{filtered.length} products</b></section>}
    <section className={styles.grid}>
      {filtered.map((p:any)=><article key={p.id}><header><div className={styles.icon}>{icon(p.product_type)}</div><div><span>{p.category} · {p.product_type}</span><h3>{p.name}</h3><code>{p.sku}</code></div></header><p>{p.description}</p><dl><div><dt>Price</dt><dd>${Number(p.price).toLocaleString()}</dd></div><div><dt>Stock</dt><dd>{p.stock_quantity}</dd></div></dl><div className={styles.actions}><button disabled={p.stock_quantity<=0} onClick={()=>buy(p)}><ShoppingCart/> Buy</button>{canRestock&&selected.restock_permission==="founder"&&<button onClick={()=>restock(p)}><RefreshCcw/> Restock</button>}</div></article>)}
    </section>
  </div>;
}
