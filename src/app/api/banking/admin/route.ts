import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();

  if (body.action === "adjust") {
    const { data, error } = await supabase.rpc("admin_adjust_bank_balance", {
      p_account_id: body.accountId,
      p_direction: body.direction,
      p_amount: Number(body.amount),
      p_reason: body.reason,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ account: data });
  }

  if (body.action === "status") {
    const { data, error } = await supabase.rpc("update_bank_account_status", {
      p_account_id: body.accountId,
      p_status: body.status,
      p_reason: body.reason || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ account: data });
  }

  if (body.action === "hold") {
    const { data, error } = await supabase.rpc("place_bank_account_hold", {
      p_account_id: body.accountId,
      p_amount: Number(body.amount),
      p_reason: body.reason,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ hold: data });
  }

  if (body.action === "release" || body.action === "seize") {
    const { error } = await supabase.rpc("release_bank_account_hold", {
      p_hold_id: body.holdId,
      p_capture: body.action === "seize",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported banking action." }, { status: 400 });
}
