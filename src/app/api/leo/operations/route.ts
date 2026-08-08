import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function hasAccess(supabase:any,userId:string,communityId:string,permission:string){
  const [{data:allowed},{data:membership}] = await Promise.all([
    supabase.rpc("has_permission",{target_community_id:communityId,requested_permission:permission}),
    supabase.from("community_memberships").select("is_owner").eq("community_id",communityId).eq("user_id",userId).eq("status","active").maybeSingle(),
  ]);
  return allowed === true || membership?.is_owner === true;
}

export async function POST(request:Request){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Authentication required."},{status:401});
  const body=await request.json();
  const communityId=String(body.communityId||"");
  const action=String(body.action||"");
  if(!communityId) return NextResponse.json({error:"Community required."},{status:400});

  if(action === "request_backup"){
    if(!(await hasAccess(supabase,user.id,communityId,"leo.request_backup"))) return NextResponse.json({error:"Backup permission required."},{status:403});
    const {data,error}=await supabase.from("leo_backup_requests").insert({community_id:communityId,shift_id:body.shiftId,officer_identifier_id:body.identifierId||null,location:body.location||null,reason:body.reason||"Officer requested backup",priority:body.priority||"normal",status:"active"}).select("*").single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({request:data});
  }

  if(action === "resolve_backup"){
    if(!(await hasAccess(supabase,user.id,communityId,"leo.manage_units"))) return NextResponse.json({error:"Unit management permission required."},{status:403});
    const {error}=await supabase.from("leo_backup_requests").update({status:"resolved",resolved_at:new Date().toISOString()}).eq("community_id",communityId).eq("id",body.id);
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({ok:true});
  }

  if(action === "traffic_stop"){
    if(!(await hasAccess(supabase,user.id,communityId,"leo.manage_traffic"))) return NextResponse.json({error:"Traffic permission required."},{status:403});
    const {data:number,error:numberError}=await supabase.rpc("next_leo_entity_number",{p_community_id:communityId,p_prefix:"TS"});
    if(numberError) return NextResponse.json({error:numberError.message},{status:400});
    const {data,error}=await supabase.from("leo_traffic_stops").insert({community_id:communityId,stop_number:number,shift_id:body.shiftId||null,officer_identifier_id:body.identifierId||null,character_id:body.characterId||null,vehicle_id:body.vehicleId||null,location:body.location,reason:body.reason,status:"active"}).select("*").single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({stop:data});
  }

  if(action === "end_traffic_stop"){
    if(!(await hasAccess(supabase,user.id,communityId,"leo.manage_traffic"))) return NextResponse.json({error:"Traffic permission required."},{status:403});
    const {error}=await supabase.from("leo_traffic_stops").update({status:"closed",outcome:body.outcome||"cleared",ended_at:new Date().toISOString()}).eq("community_id",communityId).eq("id",body.id);
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({ok:true});
  }

  if(action === "tow_request"){
    if(!(await hasAccess(supabase,user.id,communityId,"leo.manage_tow"))) return NextResponse.json({error:"Tow permission required."},{status:403});
    const {data:number,error:numberError}=await supabase.rpc("next_leo_entity_number",{p_community_id:communityId,p_prefix:"TOW"});
    if(numberError) return NextResponse.json({error:numberError.message},{status:400});
    const {data,error}=await supabase.from("leo_tow_requests").insert({community_id:communityId,request_number:number,vehicle_id:body.vehicleId||null,requested_by_identifier_id:body.identifierId||null,location:body.location,reason:body.reason,priority:body.priority||"normal",status:"requested"}).select("*").single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({tow:data});
  }

  if(action === "complete_tow"){
    if(!(await hasAccess(supabase,user.id,communityId,"leo.manage_tow"))) return NextResponse.json({error:"Tow permission required."},{status:403});
    const {error}=await supabase.from("leo_tow_requests").update({status:"completed",completed_at:new Date().toISOString()}).eq("community_id",communityId).eq("id",body.id);
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({ok:true});
  }

  return NextResponse.json({error:"Unknown LEO operation."},{status:400});
}
