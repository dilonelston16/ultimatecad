"use client";

import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CreditCard,
  Package,
  Plus,
  ReceiptText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./economy.module.css";

export default function EconomyClient({
  character,accounts,loans,businesses,jobs,bills,payments,inventory,
}: any) {
  const router=useRouter();
  const [mode,setMode]=useState<"business"|"loan"|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  const total=useMemo(
    ()=>accounts.reduce((sum:number,a:any)=>sum+Number(a.balance||0),0),
    [accounts]
  );

  async function submitBusiness(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault(); setBusy(true); setMessage("");
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/economy/businesses",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({
        characterId:character.id,
        name:form.get("name"),
        businessType:form.get("businessType"),
        description:form.get("description"),
        address:form.get("address"),
        phone:form.get("phone"),
      }),
    });
    const body=await response.json(); setBusy(false);
    if(!response.ok) return setMessage(body.error||"Business registration failed.");
    setMessage("Business registered."); setMode(null); router.refresh();
  }

  async function submitLoan(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault(); setBusy(true); setMessage("");
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/economy/loans",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({
        characterId:character.id,
        destinationAccountId:form.get("destinationAccountId"),
        loanType:form.get("loanType"),
        principal:form.get("principal"),
        termMonths:form.get("termMonths"),
        purpose:form.get("purpose"),
      }),
    });
    const body=await response.json(); setBusy(false);
    if(!response.ok) return setMessage(body.error||"Loan application failed.");
    setMessage("Loan application submitted."); setMode(null); router.refresh();
  }

  return <div className={styles.page}>
    <section className={styles.hero}>
      <div><span>Economic profile</span><h2>${total.toLocaleString(undefined,{minimumFractionDigits:2})}</h2><p>Total cash across personal bank accounts.</p></div>
      <div>
        <button onClick={()=>setMode(mode==="business"?null:"business")}><BriefcaseBusiness size={17}/> Register business</button>
        <button onClick={()=>setMode(mode==="loan"?null:"loan")}><CreditCard size={17}/> Apply for loan</button>
      </div>
    </section>

    {message&&<div className={styles.message}>{message}</div>}

    {mode==="business"&&<form className={styles.form} onSubmit={submitBusiness}>
      <h3>Register a business</h3>
      <div>
        <label>Name<input name="name" required/></label>
        <label>Business type<input name="businessType" required placeholder="Automotive, retail, legal..."/></label>
        <label>Address<input name="address"/></label>
        <label>Phone<input name="phone"/></label>
        <label className={styles.full}>Description<textarea name="description"/></label>
      </div>
      <button disabled={busy}>{busy?"Registering…":"Register business"}</button>
    </form>}

    {mode==="loan"&&<form className={styles.form} onSubmit={submitLoan}>
      <h3>Loan application</h3>
      <div>
        <label>Deposit account<select name="destinationAccountId" required><option value="">Select account</option>{accounts.map((a:any)=><option key={a.id} value={a.id}>{a.name} · {a.account_number}</option>)}</select></label>
        <label>Loan type<select name="loanType"><option value="personal">Personal</option><option value="vehicle">Vehicle</option><option value="business">Business</option><option value="property">Property</option><option value="emergency">Emergency</option></select></label>
        <label>Amount<input name="principal" type="number" min="1" required/></label>
        <label>Term months<input name="termMonths" type="number" min="1" max="120" required/></label>
        <label className={styles.full}>Purpose<textarea name="purpose"/></label>
      </div>
      <button disabled={busy}>{busy?"Submitting…":"Submit loan application"}</button>
    </form>}

    <section className={styles.stats}>
      <article><Banknote/><span>Bank accounts</span><strong>{accounts.length}</strong></article>
      <article><BriefcaseBusiness/><span>Businesses</span><strong>{businesses.length}</strong></article>
      <article><ReceiptText/><span>Open bills</span><strong>{bills.filter((b:any)=>!["paid","cancelled","waived"].includes(b.status)).length}</strong></article>
      <article><CalendarClock/><span>Scheduled payments</span><strong>{payments.length}</strong></article>
    </section>

    <div className={styles.columns}>
      <section className={styles.panel}>
        <header><span>Financing</span><h3>Loans</h3></header>
        <div>{loans.length?loans.map((loan:any)=><article key={loan.id}><div><b>{loan.loan_type} loan</b><code>{loan.loan_number}</code></div><span>{loan.status}</span><strong>${Number(loan.remaining_balance).toLocaleString()}</strong></article>):<p>No loan applications.</p>}</div>
      </section>

      <section className={styles.panel}>
        <header><span>Employment</span><h3>Jobs and businesses</h3></header>
        <div>{jobs.map((job:any)=><article key={job.id}><div><b>{job.job_title}</b><small>{job.employer_name}</small></div><strong>${Number(job.pay_rate).toLocaleString()}</strong></article>)}{businesses.map((business:any)=><article key={business.id}><div><b>{business.name}</b><small>{business.business_type}</small></div><span>{business.status}</span></article>)}{!jobs.length&&!businesses.length&&<p>No employment or businesses.</p>}</div>
      </section>
    </div>

    <div className={styles.columns}>
      <section className={styles.panel}>
        <header><span>Obligations</span><h3>Bills and upcoming payments</h3></header>
        <div>{[...bills,...payments].length?[...bills,...payments].slice(0,8).map((item:any)=><article key={item.id}><div><b>{item.description}</b><small>{new Date(item.due_at||item.next_due_at).toLocaleDateString()}</small></div><strong>${Number(item.amount).toLocaleString()}</strong></article>):<p>No upcoming payments.</p>}</div>
      </section>

      <section className={styles.panel}>
        <header><span>Inventory</span><h3>Recent items</h3></header>
        <div>{inventory.length?inventory.map((item:any)=><article key={item.id}><Package/><div><b>{item.item_name}</b><small>Quantity {item.quantity}</small></div></article>):<p>No inventory items.</p>}</div>
      </section>
    </div>
  </div>;
}
