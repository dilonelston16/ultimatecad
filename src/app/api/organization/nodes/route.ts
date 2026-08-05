import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const allowed = ["agency","department","division","subdivision"];
const slugify = (value:string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error:"Authentication required"},{status:401});
  const body = await request.json();
  if (!body.communityId || !allowed.includes(body.nodeType) || !body.name?.trim()) return NextResponse.json({error:"Invalid organization item"},{status:400});
  const { data: owner } = await supabase.from("community_memberships").select("id").eq("community_id",body.communityId).eq("user_id",user.id).eq("status","active").eq("is_owner",true).maybeSingle();
  if (!owner) return NextResponse.json({error:"Founder access required"},{status:403});
  const { count } = await supabase.from("organization_nodes").select("id",{count:"exact",head:true}).eq("community_id",body.communityId).eq("parent_id",body.parentId ?? null);
  const slug = `${slugify(body.name)}-${Date.now().toString(36).slice(-4)}`;
  const { data: node, error } = await supabase.from("organization_nodes").insert({community_id:body.communityId,parent_id:body.parentId ?? null,node_type:body.nodeType,name:body.name.trim(),slug,sort_order:(count ?? 0)*10+10}).select().single();
  if (error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({node});
}
