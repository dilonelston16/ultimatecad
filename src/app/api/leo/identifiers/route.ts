import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (body.action === "select") {
    const { data, error } = await supabase.rpc(
      "select_leo_identifier",
      {
        p_identifier_id: body.identifierId,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ identifier: data });
  }

  if (body.action === "archive" || body.action === "restore") {
    const { data, error } = await supabase.rpc(
      "archive_leo_identifier",
      {
        p_identifier_id: body.identifierId,
        p_archive: body.action === "archive",
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ identifier: data });
  }

  const { data, error } = await supabase.rpc(
    "save_leo_identifier",
    {
      p_community_id: body.communityId,
      p_identifier_id: body.identifierId || null,
      p_identifier_name: body.identifierName,
      p_callsign: body.callsign,
      p_badge_number: body.badgeNumber || "",
      p_rank_name: body.rankName || "",
      p_console_platform: body.consolePlatform || "",
      p_agency_node_id: body.agencyNodeId || null,
      p_department_node_id: body.departmentNodeId || null,
      p_division_node_id: body.divisionNodeId || null,
      p_subdivision_node_id: body.subdivisionNodeId || null,
      p_is_default: body.isDefault === true,
      p_default_status: body.defaultStatus || "available",
      p_certifications: body.certifications || [],
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ identifier: data });
}
