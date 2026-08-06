import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase.rpc("create_business", {
    p_character_id: body.characterId,
    p_name: body.name,
    p_business_type: body.businessType,
    p_description: body.description || null,
    p_address: body.address || null,
    p_phone: body.phone || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ business: data });
}
