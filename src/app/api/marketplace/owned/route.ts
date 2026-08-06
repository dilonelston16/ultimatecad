import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();

  if (body.action === "cancel") {
    const { error } = await supabase.rpc("cancel_owned_marketplace_listing", {
      p_listing_id: body.listingId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  const { data, error } = await supabase.rpc("create_owned_marketplace_listing", {
    p_character_id: body.characterId,
    p_asset_kind: body.assetKind,
    p_asset_id: body.assetId,
    p_quantity: Number(body.quantity || 1),
    p_price: Number(body.price),
    p_description: body.description || null,
    p_seller_account_id: body.sellerAccountId || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ listing: data });
}
