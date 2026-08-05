import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const validPlatforms = new Set(["ps4", "ps5", "xbox_one", "xbox_series"]);

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const prefix = String(body.prefix ?? "").trim().toUpperCase();
  const slug = String(body.slug ?? "").trim().toLowerCase();
  const timezone = String(body.timezone ?? "America/Montreal");
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((value: unknown): value is string => typeof value === "string" && validPlatforms.has(value))
    : [];

  if (name.length < 3 || prefix.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || platforms.length === 0) {
    return NextResponse.json({ error: "Complete all required community fields." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_community", {
    p_name: name,
    p_prefix: prefix,
    p_slug: slug,
    p_timezone: timezone,
    p_platforms: platforms,
  });

  if (error) {
    const message = error.message.includes("communities_slug_key") ? "That community slug is already in use." : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ communityId: data });
}
