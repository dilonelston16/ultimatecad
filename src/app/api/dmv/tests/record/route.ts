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

  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId : "";
  const testType =
    body.testType === "written" || body.testType === "practical"
      ? body.testType
      : "";
  const passed = Boolean(body.passed);
  const score =
    body.score === null || body.score === undefined || body.score === ""
      ? null
      : Number(body.score);
  const notes = typeof body.notes === "string" ? body.notes : "";

  if (!applicationId || !testType) {
    return NextResponse.json(
      { error: "Application and test type are required." },
      { status: 400 }
    );
  }

  const { error } = await supabase.rpc("record_license_test", {
    p_application_id: applicationId,
    p_test_type: testType,
    p_passed: passed,
    p_score: score,
    p_notes: notes || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
