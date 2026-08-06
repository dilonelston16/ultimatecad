import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase.rpc("create_vehicle_insurance_policy", {
    p_character_id: body.characterId,
    p_vehicle_id: body.vehicleId,
    p_provider_name: body.providerName,
    p_coverage_type: body.coverageType,
    p_premium: Number(body.premium || 0),
    p_deductible: Number(body.deductible || 0),
    p_coverage_limit: body.coverageLimit ? Number(body.coverageLimit) : null,
    p_auto_renew: Boolean(body.autoRenew),
    p_notes: body.notes || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ policy: data });
}
