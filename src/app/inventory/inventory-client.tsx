"use client";

import { Boxes, Building2, Car, Home, Package, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./inventory.module.css";

export default function InventoryClient({items,vehicles,weapons,properties,businesses}:any){
  const [tab,setTab]=useState("items");
  const groups:any={items,vehicles,weapons,properties,businesses};
  const records=groups[tab]??[];

  const total=useMemo(()=>items.reduce((s:number,i:any)=>s+Number(i.quantity||0),0),[items]);

  return <div className={styles.page}>
    <section className={styles.hero}><div><span>Owned assets</span><h2>{total} inventory items</h2><p>View physical items, vehicles, registered weapons, properties, and businesses owned by this character.</p></div><Boxes/></section>
    <nav className={styles.tabs}>
      {[["items","Items",Package],["vehicles","Vehicles",Car],["weapons","Weapons",Shield],["properties","Properties",Home],["businesses","Businesses",Building2]].map(([id,label,Icon]:any)=><button key={id} className={tab===id?styles.active:""} onClick={()=>setTab(id)}><Icon size={15}/>{label}<span>{groups[id].length}</span></button>)}
    </nav>
    <section className={styles.grid}>
      {records.length?records.map((r:any)=>{
        const product=Array.isArray(r.product)?r.product[0]:r.product;
        return <article key={r.id}>
          <header><div className={styles.icon}>{tab==="items"?<Package/>:tab==="vehicles"?<Car/>:tab==="weapons"?<Shield/>:tab==="properties"?<Home/>:<Building2/>}</div><div><span>{product?.category||r.vehicle_type||r.weapon_type||r.property_type||r.business_type||tab}</span><h3>{r.item_name||`${r.model_year??""} ${r.make??""} ${r.model??""}`.trim()||r.address||r.name}</h3><code>{r.plate_number||r.serial_number||r.property_number||r.business_number||product?.sku||""}</code></div><b>{r.status||"owned"}</b></header>
          <dl>
            {tab==="items"&&<><div><dt>Quantity</dt><dd>{r.quantity}</dd></div><div><dt>Listed</dt><dd>{r.listed_quantity??0}</dd></div></>}
            {tab==="vehicles"&&<><div><dt>Plate</dt><dd>{r.plate_number}</dd></div><div><dt>VIN</dt><dd>{r.vin}</dd></div></>}
            {tab==="weapons"&&<><div><dt>Caliber</dt><dd>{r.caliber||"—"}</dd></div><div><dt>Registration</dt><dd>{r.registration_number}</dd></div></>}
            {tab==="properties"&&<><div><dt>Type</dt><dd>{r.property_type}</dd></div><div><dt>Garage spaces</dt><dd>{r.garage_spaces}</dd></div></>}
            {tab==="businesses"&&<><div><dt>Type</dt><dd>{r.business_type}</dd></div><div><dt>Number</dt><dd>{r.business_number}</dd></div></>}
          </dl>
        </article>
      }):<div className={styles.empty}><Package size={42}/><h3>No owned {tab}</h3><p>Purchases and registered assets will appear here.</p></div>}
    </section>
  </div>;
}
