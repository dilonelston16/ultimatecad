import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "pay") {
    const { data, error } = await supabase.rpc("pay_business_employee", {
      p_member_id: body.memberId,
      p_amount: Number(body.amount),
      p_description: body.description || "Employee payment",
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ transferId: data });
  }

  if (["promote", "demote", "fire", "rehire", "update"].includes(body.action)) {
    const { data, error } = await supabase.rpc("update_business_employee", {
      p_member_id: body.memberId,
      p_action: body.action,
      p_role_name: body.roleName || null,
      p_pay_rate:
        body.payRate === "" || body.payRate === undefined
          ? null
          : Number(body.payRate),
      p_reason: body.reason || null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ member: data });
  }

  const { data, error } = await supabase.rpc("add_business_employee", {
    p_business_id: body.businessId,
    p_state_id: body.stateId,
    p_role_name: body.roleName,
    p_pay_type: body.payType,
    p_pay_rate: Number(body.payRate),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ member: data });
}
