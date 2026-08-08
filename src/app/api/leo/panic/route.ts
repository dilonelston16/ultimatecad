import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "resolve") {
    const { data, error } = await supabase.rpc("resolve_leo_panic", {
      p_alert_id: body.alertId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ alert: data });
  }

  const { data, error } = await supabase.rpc("activate_leo_panic", {
    p_shift_id: body.shiftId,
    p_location: body.location || null,
    p_message: body.message || "Officer activated emergency panic",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ alert: data });
}
