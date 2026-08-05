import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function context(id:string) {
  const supabase = await createServerSupabaseClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return { error:NextResponse.json({error:"Authentication required"},{status:401}) };
  const { data:node } = await supabase.from("organization_nodes").select("id,community_id").eq("id",id).maybeSingle();
  if (!node) return { error:NextResponse.json({error:"Organization item not found"},{status:404}) };
  const { data:owner } = await supabase.from("community_memberships").select("id").eq("community_id",node.community_id).eq("user_id",user.id).eq("status","active").eq("is_owner",true).maybeSingle();
  if (!owner) return { error:NextResponse.json({error:"Founder access required"},{status:403}) };
  return { supabase, node };
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const ctx=await context(id); if (ctx.error) return ctx.error;
  const body=await request.json();
  const update={name:String(body.name??"").trim(),description:body.description||null,color:body.color||null,abbreviation:body.abbreviation||null,callsign_prefix:body.callsign_prefix||null,logo_url:body.logo_url||null,updated_at:new Date().toISOString()};
  if (!update.name) return NextResponse.json({error:"Name is required"},{status:400});
  const {data:node,error}=await ctx.supabase!.from("organization_nodes").update(update).eq("id",id).select().single();
  if(error) return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({node});
}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const ctx=await context(id); if(ctx.error) return ctx.error;
  const {error}=await ctx.supabase!.from("organization_nodes").update({is_archived:true,updated_at:new Date().toISOString()}).eq("id",id);
  if(error) return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({ok:true});
}
