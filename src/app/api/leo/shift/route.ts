import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "clock_in") {
    const { data, error } = await supabase.rpc("clock_in_leo", {
      p_community_id: body.communityId,
      p_callsign: body.callsign,
      p_badge_number: body.badgeNumber || "",
      p_rank_name: body.rankName || "",
      p_console_platform: body.consolePlatform || "",
      p_agency_node_id: body.agencyNodeId || null,
      p_department_node_id: body.departmentNodeId || null,
      p_division_node_id: body.divisionNodeId || null,
      p_subdivision_node_id: body.subdivisionNodeId || null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ shift: data });
  }

  const { data, error } = await supabase.rpc("update_leo_shift", {
    p_shift_id: body.shiftId,
    p_action: body.action,
    p_status: body.status || null,
    p_assignment: body.assignment || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ shift: data });
}
