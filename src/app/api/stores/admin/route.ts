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

  if (body.action === "delete") {
    const { error } = await supabase.rpc(
      "admin_delete_store_product",
      {
        p_product_id: body.productId,
        p_reason: body.reason || null,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  if (body.action === "bulk-import") {
    const { data, error } = await supabase.rpc(
      "admin_bulk_import_store_catalog",
      {
        p_community_id: body.communityId,
        p_catalog: body.catalog,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ result: data });
  }

  const { data, error } = await supabase.rpc(
    "admin_upsert_store_product",
    {
      p_store_id: body.storeId,
      p_product_id: body.productId || null,
      p_sku: body.sku,
      p_name: body.name,
      p_description: body.description || "",
      p_category: body.category || "Other",
      p_product_type: body.productType || "item",
      p_price: Number(body.price),
      p_stock_quantity: Number(body.stockQuantity),
      p_active: body.active !== false,
      p_restricted: body.restricted === true,
      p_asset_template: body.assetTemplate || {},
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ product: data });
}
