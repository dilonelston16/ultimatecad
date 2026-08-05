"use client";

import { ChevronDown, CircleUserRound, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Character = { id:string; state_id:string; first_name:string; middle_name:string|null; last_name:string; status:string; is_archived:boolean };

export default function CharacterSwitcher() {
  const router = useRouter();
  const [characters,setCharacters] = useState<Character[]>([]);
  const [activeId,setActiveId] = useState("");
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/characters", { cache: "no-store" })
      .then(r => r.json())
      .then(body => { setCharacters((body.characters ?? []).filter((c:Character)=>!c.is_archived)); setActiveId(body.activeCharacterId ?? ""); })
      .finally(()=>setLoading(false));
  },[]);

  async function switchCharacter(characterId:string) {
    setActiveId(characterId);
    await fetch("/api/characters/active", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({characterId}) });
    router.refresh();
  }

  if (loading) return <div className="character-switcher skeleton-line">Loading character…</div>;
  if (!characters.length) return <Link className="character-switcher empty" href="/civilian/characters/new"><Plus size={16}/>Create first character</Link>;
  const active = characters.find(c=>c.id===activeId) ?? characters[0];

  return <div className="character-switcher">
    <CircleUserRound size={17}/>
    <select value={active?.id ?? ""} onChange={e=>switchCharacter(e.target.value)} aria-label="Active character">
      {characters.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.state_id}</option>)}
    </select>
    <ChevronDown size={14}/>
  </div>;
}
