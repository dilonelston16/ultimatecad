import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase.rpc("apply_for_loan", {
    p_character_id: body.characterId,
    p_destination_account_id: body.destinationAccountId,
    p_loan_type: body.loanType,
    p_principal: Number(body.principal),
    p_term_months: Number(body.termMonths),
    p_purpose: body.purpose || null,
    p_collateral_type: body.collateralType || null,
    p_collateral_id: body.collateralId || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ loan: data });
}
