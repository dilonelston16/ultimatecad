import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json();
  if (body.action === "process") {
    const { data, error } = await supabase.rpc("process_payroll_run", { p_payroll_run_id: body.payrollRunId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ payroll: data });
  }
  const { data, error } = await supabase.rpc("create_payroll_run", {
    p_business_id: body.businessId,
    p_pay_period_start: body.payPeriodStart,
    p_pay_period_end: body.payPeriodEnd,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ payroll: data });
}
