import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = await request.json();
    const { data, error } = await supabase.rpc("create_vehicle_registration", {
      p_character_id: body.characterId,
      p_make: body.make,
      p_model: body.model,
      p_model_year: Number(body.modelYear),
      p_color: body.color,
      p_secondary_color: body.secondaryColor || null,
      p_vehicle_type: body.vehicleType || "car",
      p_body_style: body.bodyStyle || null,
      p_plate_number: body.plateNumber || null,
      p_purchase_price: body.purchasePrice ? Number(body.purchasePrice) : null,
      p_financed: Boolean(body.financed),
      p_lienholder: body.lienholder || null,
      p_notes: body.notes || null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ vehicle: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vehicle registration failed." },
      { status: 500 }
    );
  }
}
