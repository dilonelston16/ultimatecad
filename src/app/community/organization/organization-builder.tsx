"use client";

import { Archive, Building2, ChevronDown, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

export type OrgNode = {
  id: string; parent_id: string | null; node_type: "agency" | "department" | "division" | "subdivision";
  name: string; slug: string; description: string | null; color: string | null; abbreviation: string | null;
  callsign_prefix: string | null; logo_url: string | null; sort_order: number; is_archived: boolean;
};

const childType = { agency: "department", department: "division", division: "subdivision", subdivision: null } as const;
const labels = { agency: "Agency", department: "Department", division: "Division", subdivision: "Subdivision" };

export default function OrganizationBuilder({ initialNodes, communityId }: { initialNodes: OrgNode[]; communityId: string }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [selected, setSelected] = useState<OrgNode | null>(initialNodes.find(n => !n.is_archived) ?? null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(initialNodes.filter(n => n.node_type !== "subdivision").map(n => n.id)));
  const [saving, setSaving] = useState(false);
  const visible = useMemo(() => nodes.filter(n => !n.is_archived), [nodes]);

  const children = (parentId: string | null) => visible.filter(n => n.parent_id === parentId).sort((a,b) => a.sort_order-b.sort_order);

  async function createNode(type: OrgNode["node_type"], parentId: string | null) {
    const name = window.prompt(`New ${labels[type]} name`);
    if (!name?.trim()) return;
    setSaving(true);
    const response = await fetch("/api/organization/nodes", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ communityId, parentId, nodeType:type, name }) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) return alert(result.error ?? "Could not create organization item.");
    setNodes(current => [...current, result.node]); setSelected(result.node);
    if (parentId) setExpanded(current => new Set(current).add(parentId));
  }

  async function saveSelected() {
    if (!selected) return; setSaving(true);
    const response = await fetch(`/api/organization/nodes/${selected.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(selected) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) return alert(result.error ?? "Could not save changes.");
    setNodes(current => current.map(n => n.id === result.node.id ? result.node : n)); setSelected(result.node);
  }

  async function archiveSelected() {
    if (!selected || !confirm(`Archive ${selected.name} and hide it from navigation?`)) return;
    setSaving(true); const response = await fetch(`/api/organization/nodes/${selected.id}`, { method:"DELETE" });
    const result = await response.json(); setSaving(false);
    if (!response.ok) return alert(result.error ?? "Could not archive item.");
    setNodes(current => current.map(n => n.id === selected.id ? { ...n, is_archived:true } : n)); setSelected(null);
  }

  function Tree({ parentId, depth=0 }: { parentId:string|null; depth?:number }) {
    return <>{children(parentId).map(node => {
      const kids = children(node.id); const open = expanded.has(node.id);
      return <div key={node.id}>
        <button className={`org-tree-row ${selected?.id===node.id ? "active":""}`} style={{ paddingLeft: 14 + depth*20 }} onClick={() => setSelected(node)}>
          <span onClick={(e)=>{e.stopPropagation(); setExpanded(cur=>{const n=new Set(cur); n.has(node.id)?n.delete(node.id):n.add(node.id); return n;});}}>
            {kids.length ? (open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>) : <span className="tree-spacer"/>}
          </span>
          <Building2 size={16}/><span><b>{node.name}</b><small>{labels[node.node_type]}{node.abbreviation ? ` · ${node.abbreviation}`:""}</small></span>
        </button>
        {open && <Tree parentId={node.id} depth={depth+1}/>} 
      </div>;
    })}</>;
  }

  return <section className="organization-builder">
    <div className="organization-toolbar">
      <div><span className="eyebrow">COMMUNITY STRUCTURE</span><h2>Build each government agency</h2><p>Civilian, banking, economy and other public modules stay outside this hierarchy.</p></div>
      <button className="button primary" onClick={()=>createNode("agency", null)} disabled={saving}><Plus size={17}/> Add agency</button>
    </div>
    <div className="organization-layout">
      <aside className="organization-tree panel">
        <div className="panel-title"><div><span className="eyebrow">NAVIGATION</span><h3>Structure</h3></div><span className="count-badge">{visible.length}</span></div>
        {children(null).length ? <Tree parentId={null}/> : <div className="empty-state">Create your first agency to begin.</div>}
      </aside>
      <main className="organization-editor panel">
        {!selected ? <div className="empty-state large"><Building2 size={42}/><h3>Select an organization item</h3><p>Choose an item from the tree or create a new agency.</p></div> : <>
          <div className="panel-title"><div><span className="eyebrow">{labels[selected.node_type].toUpperCase()}</span><h2>{selected.name}</h2></div><button className="button danger-ghost" onClick={archiveSelected}><Archive size={16}/> Archive</button></div>
          <div className="org-form-grid">
            <label>Name<input value={selected.name} onChange={e=>setSelected({...selected,name:e.target.value})}/></label>
            <label>Abbreviation<input value={selected.abbreviation ?? ""} onChange={e=>setSelected({...selected,abbreviation:e.target.value})} placeholder="LSPD"/></label>
            <label>Callsign prefix<input value={selected.callsign_prefix ?? ""} onChange={e=>setSelected({...selected,callsign_prefix:e.target.value})} placeholder="2A"/></label>
            <label>Brand color<input value={selected.color ?? ""} onChange={e=>setSelected({...selected,color:e.target.value})} placeholder="#2f7df6"/></label>
            <label className="full">Description<textarea value={selected.description ?? ""} onChange={e=>setSelected({...selected,description:e.target.value})} rows={4}/></label>
            <label className="full">Logo URL<input value={selected.logo_url ?? ""} onChange={e=>setSelected({...selected,logo_url:e.target.value})} placeholder="https://..."/></label>
          </div>
          <div className="org-editor-actions">
            {childType[selected.node_type] && <button className="button secondary" onClick={()=>createNode(childType[selected.node_type]!, selected.id)} disabled={saving}><Plus size={16}/> Add {labels[childType[selected.node_type]!]}</button>}
            <button className="button primary" onClick={saveSelected} disabled={saving}>{saving?<RefreshCw className="spin" size={16}/>:null} Save changes</button>
          </div>
        </>}
      </main>
    </div>
  </section>;
}
