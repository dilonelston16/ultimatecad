import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json();
  if (body.action === "category") {
    const { data, error } = await supabase.rpc("add_business_store_category", {
      p_business_id: body.businessId,
      p_name: body.name,
      p_description: body.description || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ category: data });
  }
  const { data, error } = await supabase.rpc("publish_business_inventory_product", {
    p_inventory_id: body.inventoryId,
    p_category_id: body.categoryId || null,
    p_price: Number(body.price),
    p_description: body.description || null,
    p_active: body.active !== false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ product: data });
}
