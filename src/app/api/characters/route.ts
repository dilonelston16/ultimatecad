import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function activeMembership(supabase: any, userId: string) {
  return supabase
    .from("community_memberships")
    .select("community_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: membership } = await activeMembership(supabase, user.id);
  if (!membership) return NextResponse.json({ characters: [], activeCharacterId: null });

  const [{ data: characters, error }, { data: active }] = await Promise.all([
    supabase.from("characters")
      .select("id,state_id,first_name,middle_name,last_name,status,is_archived,photo_url")
      .eq("community_id", membership.community_id)
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("active_characters")
      .select("character_id")
      .eq("community_id", membership.community_id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ characters: characters ?? [], activeCharacterId: active?.character_id ?? null });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: membership } = await activeMembership(supabase, user.id);
  if (!membership) return NextResponse.json({ error: "Active community membership required" }, { status: 403 });

  const body = await request.json();
  if (!body.firstName?.trim() || !body.lastName?.trim() || !body.dateOfBirth) {
    return NextResponse.json({ error: "First name, last name and date of birth are required" }, { status: 400 });
  }

  const { data: character, error } = await supabase.rpc("create_character", {
    p_community_id: membership.community_id,
    p_first_name: body.firstName,
    p_middle_name: body.middleName ?? "",
    p_last_name: body.lastName,
    p_date_of_birth: body.dateOfBirth,
    p_gender: body.gender ?? "",
    p_phone_number: body.phoneNumber ?? "",
    p_address: body.address ?? "",
    p_occupation: body.occupation ?? "",
    p_emergency_contact_name: body.emergencyContactName ?? "",
    p_emergency_contact_phone: body.emergencyContactPhone ?? "",
    p_hair_color: body.hairColor ?? "",
    p_eye_color: body.eyeColor ?? "",
    p_height: body.height ?? "",
    p_weight: body.weight ?? "",
    p_photo_url: body.photoUrl ?? "",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ character }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Character ID required" }, { status: 400 });

  const allowed: Record<string, unknown> = {};
  const fields = ["first_name","middle_name","last_name","date_of_birth","gender","phone_number","address","occupation","emergency_contact_name","emergency_contact_phone","hair_color","eye_color","height","weight","photo_url","status","is_archived"];
  for (const field of fields) if (field in body) allowed[field] = body[field];
  allowed.updated_at = new Date().toISOString();

  const { data: character, error } = await supabase.from("characters")
    .update(allowed).eq("id", body.id).eq("owner_user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (body.is_archived === true) {
    await supabase.from("active_characters").delete().eq("character_id", body.id).eq("user_id", user.id);
  }
  return NextResponse.json({ character });
}
