import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();
  const licenseId = typeof body.licenseId === "string" ? body.licenseId : "";
  const action = typeof body.action === "string" ? body.action : "";
  const reason = typeof body.reason === "string" ? body.reason : "";
  const points = Number.isFinite(Number(body.points)) ? Number(body.points) : 0;
  const expiration =
    typeof body.expiration === "string" && body.expiration
      ? new Date(body.expiration).toISOString()
      : null;

  const { data, error } = await supabase.rpc("manage_license", {
    p_license_id: licenseId,
    p_action: action,
    p_reason: reason,
    p_points: points,
    p_expiration: expiration,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ license: data });
}
