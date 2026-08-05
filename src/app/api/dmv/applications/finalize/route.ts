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
  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId : "";
  const decision = typeof body.decision === "string" ? body.decision : "";
  const notes = typeof body.notes === "string" ? body.notes : "";

  const { data, error } = await supabase.rpc("finalize_license_application", {
    p_application_id: applicationId,
    p_decision: decision,
    p_notes: notes,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ application: data });
}
