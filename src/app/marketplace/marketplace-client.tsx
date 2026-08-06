"use client";

import { Building2, Car, Home, Package, Plus, Search, Shield, Store, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./marketplace.module.css";

export default function MarketplaceClient({character,listings,ownership,accounts}:any){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [kind,setKind]=useState("item");
  const [search,setSearch]=useState("");
  const [message,setMessage]=useState("");

  const assets=ownership[`${kind}s`]??ownership[kind]??[];
  const filtered=useMemo(()=>listings.filter((l:any)=>[l.title,l.description,l.listing_type,l.listing_number].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())),[listings,search]);

  const label=(a:any)=>kind==="item"?`${a.item_name} (${Math.max(0,a.quantity-(a.listed_quantity||0))} available)`:kind==="vehicle"?`${a.model_year} ${a.make} ${a.model} · ${a.plate_number}`:kind==="weapon"?`${a.make} ${a.model} · ${a.serial_number}`:kind==="property"?`${a.property_type} · ${a.address}`:a.name;

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget);
    const response=await fetch("/api/marketplace/owned",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({characterId:character.id,assetKind:kind,assetId:f.get("assetId"),quantity:f.get("quantity")||1,price:f.get("price"),description:f.get("description"),sellerAccountId:f.get("sellerAccountId")})});
    const body=await response.json();
    if(!response.ok)return setMessage(body.error||"Listing failed.");
    setMessage("Owned asset listed.");setOpen(false);router.refresh();
  }

  async function cancel(id:string){
    const response=await fetch("/api/marketplace/owned",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"cancel",listingId:id})});
    const body=await response.json();
    if(!response.ok)return setMessage(body.error||"Cancel failed.");
    router.refresh();
  }

  function icon(type:string){return type==="vehicle"?<Car/>:type==="weapon"?<Shield/>:type==="property"?<Home/>:type==="business"?<Building2/>:<Package/>}

  return <div className={styles.page}>
    {message&&<div className={styles.message}>{message}</div>}
    <section className={styles.hero}><div><span>Owned asset marketplace</span><h2>{listings.length} active listings</h2><p>Listings are validated against the seller's actual inventory, vehicles, weapons, properties, or businesses.</p></div><button onClick={()=>setOpen(!open)}>{open?<X/>:<Plus/>}{open?"Close":"Create listing"}</button></section>
    {open&&<form className={styles.form} onSubmit={submit}><header><h3>List something you own</h3></header><div className={styles.formGrid}><label>Asset type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="item">Inventory item</option><option value="vehicle">Vehicle</option><option value="weapon">Weapon</option><option value="property">Property</option><option value="business">Business</option></select></label><label>Owned asset<select name="assetId" required><option value="">Choose owned asset</option>{assets.map((a:any)=><option key={a.id} value={a.id}>{label(a)}</option>)}</select></label>{kind==="item"&&<label>Quantity<input name="quantity" type="number" min="1" defaultValue="1" required/></label>}<label>Price<input name="price" type="number" min="0" required/></label><label>Deposit account<select name="sellerAccountId"><option value="">Select account</option>{accounts.map((a:any)=><option key={a.id} value={a.id}>{a.name} · {a.account_number}</option>)}</select></label><label className={styles.full}>Description<textarea name="description"/></label></div><button>Create verified listing</button></form>}
    <section className={styles.search}><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search marketplace..."/></section>
    <section className={styles.grid}>{filtered.map((l:any)=>{const seller=Array.isArray(l.seller)?l.seller[0]:l.seller;return <article key={l.id}><header><div className={styles.icon}>{icon(l.listing_type)}</div><div><span>{l.listing_type}</span><h3>{l.title}</h3><code>{l.listing_number}</code></div><strong>${Number(l.price).toLocaleString()}</strong></header><p>{l.description||"No description."}</p><footer><span>Seller: {seller?.first_name} {seller?.last_name}</span>{l.seller_character_id===character.id&&<button onClick={()=>cancel(l.id)}>Cancel</button>}</footer></article>})}</section>
  </div>;
}
