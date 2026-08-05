import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const safeNext = requestedNext?.startsWith("/") ? requestedNext : null;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback", url.origin));
  }

  if (safeNext) {
    return NextResponse.redirect(new URL(safeNext, url.origin));
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(new URL("/login?error=session", url.origin));
  }

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return NextResponse.redirect(
    new URL(membership ? "/dashboard" : "/onboarding", url.origin),
  );
}
