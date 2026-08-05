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
  const answers =
    body.answers && typeof body.answers === "object" ? body.answers : {};

  if (!applicationId) {
    return NextResponse.json(
      { error: "Application ID is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("submit_written_license_test", {
    p_application_id: applicationId,
    p_answers: answers,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    score: Number(result?.score ?? 0),
    passed: Boolean(result?.passed),
  });
}
