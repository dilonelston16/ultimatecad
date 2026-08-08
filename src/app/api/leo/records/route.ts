import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function access(supabase:any,userId:string,communityId:string,permission="leo.manage_reports") {
  const [{data:allowed},{data:membership}] = await Promise.all([
    supabase.rpc("has_permission",{target_community_id:communityId,requested_permission:permission}),
    supabase.from("community_memberships").select("is_owner").eq("community_id",communityId).eq("user_id",userId).eq("status","active").maybeSingle()
  ]);
  return allowed === true || membership?.is_owner === true;
}

export async function GET(request:Request){
 const supabase=await createServerSupabaseClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user) return NextResponse.json({error:"Authentication required."},{status:401});
 const url=new URL(request.url), communityId=String(url.searchParams.get("communityId")||""), recordId=String(url.searchParams.get("id")||"");
 if(!communityId || !recordId || !(await access(supabase,user.id,communityId,"leo.view_records"))) return NextResponse.json({error:"LEO record access required."},{status:403});
 const {data,error}=await supabase.from("leo_records").select("*,character:characters(first_name,last_name,state_id),vehicle:vehicles(plate_number,make,model,vin),officer:leo_unit_profiles(identifier_name,callsign,badge_number,rank_name),charges:leo_record_charges(*)").eq("community_id",communityId).eq("id",recordId).maybeSingle();
 if(error) return NextResponse.json({error:error.message},{status:400});
 if(!data) return NextResponse.json({error:"Record not found."},{status:404});
 return NextResponse.json({record:data});
}
export async function POST(request:Request){
 const supabase=await createServerSupabaseClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user) return NextResponse.json({error:"Authentication required."},{status:401});
 const body=await request.json(); const communityId=String(body.communityId||"");
 if(!communityId || !(await access(supabase,user.id,communityId))) return NextResponse.json({error:"LEO records permission required."},{status:403});
 const recordType=String(body.recordType||""); if(!["report","citation","arrest"].includes(recordType)) return NextResponse.json({error:"Invalid record type."},{status:400});
 const prefix=recordType==="report"?"RPT":recordType==="citation"?"CIT":"ARR";
 const {data:number,error:numberError}=await supabase.rpc("next_leo_record_number",{p_community_id:communityId,p_prefix:prefix});
 if(numberError) return NextResponse.json({error:numberError.message},{status:400});
 const charges=Array.isArray(body.charges)?body.charges:[];
 const totalFine=charges.reduce((n:number,c:any)=>n+Number(c.fine_amount||0),0)+Number(body.additionalFine||0), totalJail=charges.reduce((n:number,c:any)=>n+Number(c.jail_minutes||0),0)+Number(body.additionalJail||0), totalPoints=charges.reduce((n:number,c:any)=>n+Number(c.points||0),0)+Number(body.additionalPoints||0), bond=charges.reduce((n:number,c:any)=>n+Number(c.bond_amount||0),0)+Number(body.additionalBond||0);
 const {data:record,error}=await supabase.from("leo_records").insert({community_id:communityId,record_number:number,record_type:recordType,status:body.status||"open",title:String(body.title||`${recordType} record`),narrative:String(body.narrative||""),character_id:body.characterId||null,vehicle_id:body.vehicleId||null,officer_identifier_id:body.identifierId||null,officer_user_id:user.id,location:body.location||null,total_fine:totalFine,total_jail_minutes:totalJail,total_points:totalPoints,bond_amount:bond,metadata:body.metadata||{}}).select("*").single();
 if(error) return NextResponse.json({error:error.message},{status:400});
 if(charges.length){ const rows=charges.map((c:any)=>({community_id:communityId,record_id:record.id,penal_code_id:c.id||null,code:c.code,title:c.title,classification:c.classification||null,fine_amount:Number(c.fine_amount||0),jail_minutes:Number(c.jail_minutes||0),points:Number(c.points||0),bond_amount:Number(c.bond_amount||0)})); const {error:e}=await supabase.from("leo_record_charges").insert(rows); if(e) return NextResponse.json({error:e.message},{status:400}); }
 await supabase.from("leo_officer_activity").insert({community_id:communityId,user_id:user.id,identifier_id:body.identifierId||null,activity_type:`${recordType}_created`,entity_type:"leo_record",entity_id:record.id,description:`Created ${number}`});
 if(body.characterId) await supabase.from("character_timeline").insert({community_id:communityId,character_id:body.characterId,actor_user_id:user.id,event_type:`leo_${recordType}`,title:`${recordType[0].toUpperCase()+recordType.slice(1)} ${number}`,description:body.title||body.narrative||null,metadata:{record_id:record.id}});
 return NextResponse.json({record});
}
