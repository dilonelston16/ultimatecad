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
    "create_character_bank_account",
    {
      p_character_id: body.characterId,
      p_account_type: body.accountType,
      p_name: body.name || null,
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ account: data });
}
