import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function permission(supabase:any,userId:string,communityId:string,key:string) {
  const [{data:allowed},{data:membership}] = await Promise.all([
    supabase.rpc("has_permission",{target_community_id:communityId,requested_permission:key}),
    supabase.from("community_memberships").select("is_owner").eq("community_id",communityId).eq("user_id",userId).eq("status","active").maybeSingle(),
  ]);
  return allowed === true || membership?.is_owner === true;
}

export async function GET(request:Request) {
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Authentication required."},{status:401});

  const url=new URL(request.url);
  const communityId=String(url.searchParams.get("communityId")||"");
  const characterId=String(url.searchParams.get("characterId")||"");
  if(!communityId || !characterId) return NextResponse.json({error:"Community and character are required."},{status:400});
  if(!(await permission(supabase,user.id,communityId,"leo.view_records"))) return NextResponse.json({error:"LEO record access required."},{status:403});

  const [character,records,warrants,bookings,stops,canClear] = await Promise.all([
    supabase.from("characters").select("id,first_name,last_name,state_id,date_of_birth,is_archived").eq("community_id",communityId).eq("id",characterId).maybeSingle(),
    supabase.from("leo_records").select("id,record_number,record_type,title,status,total_fine,total_jail_minutes,total_points,bond_amount,created_at").eq("community_id",communityId).eq("character_id",characterId).order("created_at",{ascending:false}),
    supabase.from("leo_warrants").select("id,warrant_number,title,status,priority,issued_at").eq("community_id",communityId).eq("character_id",characterId).order("issued_at",{ascending:false}),
    supabase.from("leo_bookings").select("id,booking_number,status,jail_minutes,bond_amount,facility,booked_at,released_at").eq("community_id",communityId).eq("character_id",characterId).order("booked_at",{ascending:false}),
    supabase.from("leo_traffic_stops").select("id,stop_number,status,location,reason,outcome,started_at,ended_at").eq("community_id",communityId).eq("character_id",characterId).order("started_at",{ascending:false}),
    permission(supabase,user.id,communityId,"leo.clear_player_records"),
  ]);

  if(character.error) return NextResponse.json({error:character.error.message},{status:400});
  if(!character.data) return NextResponse.json({error:"Character not found."},{status:404});
  const errors=[records.error,warrants.error,bookings.error,stops.error].filter(Boolean);
  if(errors.length) return NextResponse.json({error:errors.map((e:any)=>e.message).join(" | ")},{status:400});

  return NextResponse.json({
    character:character.data,
    records:records.data??[],warrants:warrants.data??[],bookings:bookings.data??[],trafficStops:stops.data??[],
    canClear,
  });
}

export async function POST(request:Request) {
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Authentication required."},{status:401});
  const body=await request.json();
  const communityId=String(body.communityId||"");
  const characterId=String(body.characterId||"");
  if(body.action!=="clear_all" || !communityId || !characterId) return NextResponse.json({error:"Invalid record-management request."},{status:400});
  if(String(body.confirmation||"").trim().toUpperCase()!=="CLEAR") return NextResponse.json({error:'Type CLEAR to confirm this permanent action.'},{status:400});
  if(!(await permission(supabase,user.id,communityId,"leo.clear_player_records"))) return NextResponse.json({error:"Supervisor record-clear permission required."},{status:403});

  const {data,error}=await supabase.rpc("clear_character_leo_records",{p_community_id:communityId,p_character_id:characterId});
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({cleared:data});
}
