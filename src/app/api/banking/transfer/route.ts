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

  const { data, error } = await supabase.rpc(
    "transfer_between_bank_accounts",
    {
      p_from_account_id: body.fromAccountId,
      p_to_account_number: body.toAccountNumber,
      p_amount: Number(body.amount),
      p_description: body.description || "Account transfer",
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ transferId: data });
}
