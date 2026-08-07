import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "self_dispatch") {
    const { data, error } = await supabase.rpc("self_dispatch_leo_call", {
      p_call_id: body.callId,
      p_shift_id: body.shiftId,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assignment: data });
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
