import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function canManage(supabase:any,userId:string,communityId:string){
  const [{data:allowed},{data:m}] = await Promise.all([
    supabase.rpc("has_permission",{target_community_id:communityId,requested_permission:"leo.manage_calls"}),
    supabase.from("community_memberships").select("is_owner").eq("community_id",communityId).eq("user_id",userId).eq("status","active").maybeSingle(),
  ]);
  return allowed === true || m?.is_owner === true;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json();

  if (body.action === "self_dispatch") {
    const { data, error } = await supabase.rpc("self_dispatch_leo_call", { p_call_id: body.callId, p_shift_id: body.shiftId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assignment: data });
  }

  if (body.action === "set_status") {
    const {data:call,error:readError}=await supabase.from("leo_calls").select("id,community_id,status").eq("id",body.callId).maybeSingle();
    if(readError || !call) return NextResponse.json({error:readError?.message || "Call not found."},{status:404});
    if(!(await canManage(supabase,user.id,call.community_id))) return NextResponse.json({error:"Call management permission required."},{status:403});
    const status=String(body.status||"");
    if(!["open","assigned","closed","cancelled"].includes(status)) return NextResponse.json({error:"Invalid call status."},{status:400});
    const patch:any={status};
    if(status === "closed" || status === "cancelled") patch.closed_at=new Date().toISOString();
    const {data,error}=await supabase.from("leo_calls").update(patch).eq("id",call.id).select("*").single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    await supabase.from("leo_call_history").insert({community_id:call.community_id,call_id:call.id,actor_user_id:user.id,event_type:`status_${status}`,description:`Call status changed from ${call.status} to ${status}`});
    return NextResponse.json({call:data});
  }

  const { data, error } = await supabase.rpc("create_leo_call", {
    p_community_id: body.communityId,
    p_title: body.title,
    p_location: body.location,
    p_priority: Number(body.priority || 3),
    p_description: body.description || null,
    p_postal: body.postal || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ call: data });
}
