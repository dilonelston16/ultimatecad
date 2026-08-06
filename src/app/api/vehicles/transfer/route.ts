import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase.rpc("request_vehicle_transfer", {
    p_vehicle_id: body.vehicleId,
    p_to_state_id: body.toStateId,
    p_sale_price: body.salePrice ? Number(body.salePrice) : null,
    p_notes: body.notes || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ transfer: data });
}
