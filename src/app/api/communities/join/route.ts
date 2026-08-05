import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const joinCode = String(body.joinCode ?? "").trim().toUpperCase();
  if (joinCode.length < 6) return NextResponse.json({ error: "Enter a valid community join code." }, { status: 400 });

  const { data, error } = await supabase.rpc("join_community_by_code", { p_join_code: joinCode });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ communityId: data });
}
