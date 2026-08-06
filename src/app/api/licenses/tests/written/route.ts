import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const applicationId =
      typeof body.applicationId === "string" ? body.applicationId : "";
    const answers =
      body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
        ? body.answers
        : {};

    if (!applicationId) {
      return NextResponse.json({ error: "Application ID is required." }, { status: 400 });
    }

    if (Object.keys(answers).length === 0) {
      return NextResponse.json({ error: "At least one answer is required." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("submit_written_license_test", {
      p_application_id: applicationId,
      p_answers: answers,
    });

    if (error) {
      console.error("Written test RPC failed:", error);
      return NextResponse.json(
        { error: error.message || "The database could not score the written test." },
        { status: 400 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return NextResponse.json(
        { error: "The test was submitted, but no score was returned." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      score: Number(result.score ?? 0),
      passed: Boolean(result.passed),
    });
  } catch (error) {
    console.error("Written test API crashed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The written test service encountered an unexpected error.",
      },
      { status: 500 }
    );
  }
}
