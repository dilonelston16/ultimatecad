"use client";

import { ArrowDownLeft, ArrowUpRight, Landmark, Plus, Send, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./banking.module.css";

export default function BankingClient({ character, accounts, transactions, canManage }: any) {
  const router=useRouter();
  const [open,setOpen]=useState<"account"|"transfer"|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const total=useMemo(()=>accounts.reduce((s:number,a:any)=>s+Number(a.balance||0),0),[accounts]);

  async function createAccount(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setMessage("");
    const f=new FormData(e.currentTarget);
    const r=await fetch("/api/banking/accounts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({characterId:character.id,accountType:f.get("accountType"),name:f.get("name")})});
    const b=await r.json();setBusy(false);
    if(!r.ok)return setMessage(b.error||"Account creation failed.");
    setMessage("Bank account opened.");setOpen(null);router.refresh();
  }

  async function transfer(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setMessage("");
    const f=new FormData(e.currentTarget);
    const r=await fetch("/api/banking/transfer",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({fromAccountId:f.get("fromAccountId"),toAccountNumber:f.get("toAccountNumber"),amount:f.get("amount"),description:f.get("description")})});
    const b=await r.json();setBusy(false);
    if(!r.ok)return setMessage(b.error||"Transfer failed.");
    setMessage("Transfer completed.");setOpen(null);router.refresh();
  }

  return <div className={styles.page}>
    <section className={styles.hero}>
      <div><span>Personal banking</span><h2>${total.toLocaleString(undefined,{minimumFractionDigits:2})}</h2><p>Total balance across all open accounts.</p></div>
      <div className={styles.heroActions}>
        <button onClick={()=>setOpen(open==="account"?null:"account")}><Plus size={17}/> Open account</button>
        <button onClick={()=>setOpen(open==="transfer"?null:"transfer")}><Send size={17}/> Transfer</button>
        {canManage&&<Link href="/banking/admin" className={styles.adminLink}><ShieldCheck size={17}/> Banking admin</Link>}
      </div>
    </section>
    {message&&<div className={styles.message}>{message}</div>}
    {open==="account"&&<form className={styles.form} onSubmit={createAccount}><header><h3>Open a bank account</h3><p>The first checking account receives the configured $25,000 starting balance.</p></header><div className={styles.formGrid}><label>Account type<select name="accountType"><option value="checking">Checking</option><option value="savings">Savings</option></select></label><label>Account name<input name="name" placeholder="Optional custom name"/></label></div><button disabled={busy}>{busy?"Opening…":"Open account"}</button></form>}
    {open==="transfer"&&<form className={styles.form} onSubmit={transfer}><header><h3>Transfer money</h3></header><div className={styles.formGrid}><label>From account<select name="fromAccountId" required><option value="">Select account</option>{accounts.filter((a:any)=>a.status==="active").map((a:any)=><option key={a.id} value={a.id}>{a.name} · {a.account_number}</option>)}</select></label><label>Receiving account<input name="toAccountNumber" required/></label><label>Amount<input name="amount" type="number" min=".01" step=".01" required/></label><label>Description<input name="description"/></label></div><button disabled={busy}>{busy?"Sending…":"Complete transfer"}</button></form>}
    <section className={styles.accountGrid}>{accounts.length?accounts.map((a:any)=><article key={a.id}><header><div className={styles.accountIcon}>{a.account_type==="savings"?<Landmark/>:<WalletCards/>}</div><div><span>{a.account_type}</span><h3>{a.name}</h3><code>{a.account_number}</code></div><b className={styles[a.status]||styles.status}>{a.status}</b></header><div className={styles.balance}><span>Available balance</span><strong>${Number(a.available_balance).toLocaleString(undefined,{minimumFractionDigits:2})}</strong></div></article>):<div className={styles.empty}><Landmark/><h3>No accounts</h3></div>}</section>
    <section className={styles.transactions}><header><h2>Recent transactions</h2></header><div>{transactions.length?transactions.map((t:any)=><article key={t.id}><div className={`${styles.transactionIcon} ${t.direction==="credit"?styles.credit:styles.debit}`}>{t.direction==="credit"?<ArrowDownLeft/>:<ArrowUpRight/>}</div><div className={styles.transactionCopy}><b>{t.description}</b><span>{t.transaction_type.replaceAll("_"," ")} · {new Date(t.created_at).toLocaleString()}</span><code>{t.transaction_number}</code></div><div className={styles.transactionAmount}><strong>{t.direction==="credit"?"+":"-"}${Number(t.amount).toLocaleString()}</strong></div></article>):<div className={styles.emptySmall}>No transactions.</div>}</div></section>
  </div>;
}
