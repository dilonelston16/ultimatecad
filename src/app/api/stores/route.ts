import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json();
  if (body.action === "product") {
    const { data, error } = await supabase.rpc("upsert_store_product", {
      p_store_id: body.storeId,
      p_product_id: body.productId || null,
      p_sku: body.sku,
      p_name: body.name,
      p_description: body.description || "",
      p_category: body.category || "",
      p_price: Number(body.price),
      p_stock_quantity: Number(body.stockQuantity),
      p_active: body.active !== false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ product: data });
  }
  const { data, error } = await supabase.rpc("create_store", {
    p_business_id: body.businessId,
    p_name: body.name,
    p_description: body.description || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ store: data });
}
