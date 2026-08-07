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

  if (body.action === "clock_in") {
    const { data, error } = await supabase.rpc(
      "clock_in_leo_identifier",
      {
        p_identifier_id: body.identifierId,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ shift: data });
  }

  const { data, error } = await supabase.rpc("update_leo_shift", {
    p_shift_id: body.shiftId,
    p_action: body.action,
    p_status: body.status || null,
    p_assignment: body.assignment || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ shift: data });
}
