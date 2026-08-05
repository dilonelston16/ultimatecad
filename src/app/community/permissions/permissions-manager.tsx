"use client";

import { Check, Copy, KeyRound, Plus, Save, ShieldCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

type Role={id:string;name:string;description:string|null;color:string|null;rank_level:number;is_system:boolean;is_archived:boolean;discord_role_id:string|null;organization_node_id:string|null};
type Permission={key:string;name:string;description:string;category:string};
type RolePermission={role_id:string;permission_key:string;allowed:boolean};
type Node={id:string;name:string;node_type:string;parent_id:string|null};
type AccessKey={id:string;label:string;code:string|null;max_uses:number|null;used_count:number;expires_at:string|null;active:boolean;role_id:string;organization_node_id:string|null;created_at:string};

export default function PermissionsManager({communityId,communityPrefix,initialRoles,permissions,initialRolePermissions,nodes,initialKeys}:{communityId:string;communityPrefix:string;initialRoles:Role[];permissions:Permission[];initialRolePermissions:RolePermission[];nodes:Node[];initialKeys:AccessKey[]}){
 const [roles,setRoles]=useState(initialRoles); const [selectedId,setSelectedId]=useState(initialRoles[0]?.id ?? "");
 const [matrix,setMatrix]=useState<Record<string,boolean>>(()=>Object.fromEntries(initialRolePermissions.map(x=>[`${x.role_id}:${x.permission_key}`,x.allowed])));
 const [keys,setKeys]=useState(initialKeys); const [message,setMessage]=useState(""); const [saving,setSaving]=useState(false);
 const selected=roles.find(r=>r.id===selectedId);
 const categories=useMemo(()=>Array.from(new Set(permissions.map(p=>p.category))),[permissions]);
 async function addRole(){ const name=prompt("Role name"); if(!name?.trim())return; const res=await fetch('/api/permissions/roles',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({communityId,name:name.trim()})}); const body=await res.json(); if(!res.ok){setMessage(body.error);return;} setRoles(v=>[...v,body.role].sort((a,b)=>b.rank_level-a.rank_level)); setSelectedId(body.role.id); }
 async function saveRole(){ if(!selected)return; setSaving(true); const allowed=permissions.filter(p=>matrix[`${selected.id}:${p.key}`]).map(p=>p.key); const res=await fetch('/api/permissions/roles',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({communityId,role:{id:selected.id,name:selected.name,description:selected.description,color:selected.color,rankLevel:selected.rank_level,discordRoleId:selected.discord_role_id,organizationNodeId:selected.organization_node_id},permissions:allowed})}); const body=await res.json(); setMessage(res.ok?'Role and permissions saved.':body.error); setSaving(false); }
 async function createKey(){ if(!selected)return; const label=prompt('Permission key label',`${selected.name} access`); if(!label)return; const maxRaw=prompt('Maximum uses (leave blank for unlimited)','1'); const daysRaw=prompt('Expires in how many days? (leave blank for no expiry)','7'); const res=await fetch('/api/permissions/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({communityId,roleId:selected.id,organizationNodeId:selected.organization_node_id,label,maxUses:maxRaw?Number(maxRaw):null,expiresInDays:daysRaw?Number(daysRaw):null,prefix:communityPrefix})}); const body=await res.json(); if(!res.ok){setMessage(body.error);return;} setKeys(v=>[body.key,...v]); setMessage(`Created ${body.key.code}`); }
 const updateSelected=(patch:Partial<Role>)=>setRoles(v=>v.map(r=>r.id===selectedId?{...r,...patch}:r));
 return <div className="permissions-manager">
  <div className="permissions-summary">
   <article><ShieldCheck/><span><b>{roles.filter(r=>!r.is_archived).length}</b> active roles</span></article>
   <article><KeyRound/><span><b>{keys.filter(k=>k.active).length}</b> active keys</span></article>
   <article><UsersRound/><span><b>{permissions.length}</b> permissions</span></article>
  </div>
  {message&&<div className="status-banner">{message}</div>}
  <div className="permissions-layout">
   <aside className="panel roles-list"><div className="panel-heading"><div><span className="eyebrow">Hierarchy</span><h2>Community roles</h2></div><button className="icon-button" onClick={addRole}><Plus size={17}/></button></div>{roles.map(r=><button key={r.id} className={`role-row${selectedId===r.id?' active':''}`} onClick={()=>setSelectedId(r.id)}><span style={{background:r.color??'#64748b'}}/><div><b>{r.name}</b><small>Rank {r.rank_level}{r.is_system?' · System':''}</small></div></button>)}</aside>
   <section className="panel role-editor">{selected?<><div className="panel-heading"><div><span className="eyebrow">Selected role</span><h2>{selected.name}</h2></div><button className="button primary" onClick={saveRole} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save role'}</button></div>
    <div className="role-fields"><label>Name<input value={selected.name} onChange={e=>updateSelected({name:e.target.value})}/></label><label>Rank level<input type="number" value={selected.rank_level} onChange={e=>updateSelected({rank_level:Number(e.target.value)})}/></label><label>Color<input type="color" value={selected.color??'#3b82f6'} onChange={e=>updateSelected({color:e.target.value})}/></label><label>Scope<select value={selected.organization_node_id??''} onChange={e=>updateSelected({organization_node_id:e.target.value||null})}><option value="">Community-wide</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.node_type}: {n.name}</option>)}</select></label><label className="full">Description<textarea rows={2} value={selected.description??''} onChange={e=>updateSelected({description:e.target.value})}/></label><label className="full">Discord role ID<input value={selected.discord_role_id??''} onChange={e=>updateSelected({discord_role_id:e.target.value})} placeholder="Prepared for future Discord sync"/></label></div>
    <div className="permission-matrix">{categories.map(category=><div key={category} className="permission-category"><h3>{category}</h3>{permissions.filter(p=>p.category===category).map(p=>{const k=`${selected.id}:${p.key}`;return <label key={p.key} className="permission-toggle"><input type="checkbox" checked={!!matrix[k]} onChange={e=>setMatrix(v=>({...v,[k]:e.target.checked}))}/><span><b>{p.name}</b><small>{p.description}</small></span>{matrix[k]&&<Check size={16}/>}</label>})}</div>)}</div>
    <div className="key-create-bar"><div><b>Permission keys</b><span>Create an expiring or limited-use key for this role.</span></div><button className="button secondary" onClick={createKey}><KeyRound size={16}/>Create key</button></div>
   </>:<div className="empty-state large">Select a role.</div>}</section>
  </div>
  <section className="panel access-keys"><div className="panel-heading"><div><span className="eyebrow">Access keys</span><h2>Generated permission keys</h2></div></div><div className="keys-table">{keys.length?keys.map(k=><div className="key-row" key={k.id}><div><b>{k.label}</b><code>{k.code}</code></div><span>{roles.find(r=>r.id===k.role_id)?.name??'Role'}</span><span>{k.used_count}/{k.max_uses??'∞'} uses</span><span>{k.expires_at?new Date(k.expires_at).toLocaleDateString():'No expiry'}</span><button className="icon-button" onClick={()=>navigator.clipboard.writeText(k.code??'')}><Copy size={15}/></button></div>):<div className="empty-state">No keys created yet.</div>}</div></section>
 </div>
}
