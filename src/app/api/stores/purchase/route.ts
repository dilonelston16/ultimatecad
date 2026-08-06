import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json();
  const { data, error } = await supabase.rpc("purchase_store_product_for_destination", {
    p_character_id: body.characterId,
    p_account_id: body.accountId,
    p_product_id: body.productId,
    p_quantity: Number(body.quantity || 1),
    p_destination_type: body.destinationType || "personal",
    p_business_id: body.businessId || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ saleId: data });
}
