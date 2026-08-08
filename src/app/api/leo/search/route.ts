import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const communityId = url.searchParams.get("communityId");

  if (!communityId || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { data: allowed } = await supabase.rpc("has_permission", {
    target_community_id: communityId,
    requested_permission: "leo.view_records",
  });

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("is_owner")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (allowed !== true && membership?.is_owner !== true) {
    return NextResponse.json({ error: "MDT search permission required." }, { status: 403 });
  }

  const like = `%${query}%`;

  const [
    characters,
    vehicles,
    weapons,
    properties,
    businesses,
    records,
    warrants,
  ] = await Promise.all([
    supabase
      .from("characters")
      .select("id,first_name,last_name,state_id,date_of_birth,is_archived")
      .eq("community_id", communityId)
      .or(`first_name.ilike.${like},last_name.ilike.${like},state_id.ilike.${like}`)
      .limit(8),
    supabase
      .from("vehicles")
      .select("id,plate_number,vin,make,model,model_year,status")
      .eq("community_id", communityId)
      .or(`plate_number.ilike.${like},vin.ilike.${like},make.ilike.${like},model.ilike.${like}`)
      .limit(8),
    supabase
      .from("weapons")
      .select("id,serial_number,registration_number,weapon_type,make,model,status")
      .eq("community_id", communityId)
      .or(`serial_number.ilike.${like},registration_number.ilike.${like},make.ilike.${like},model.ilike.${like}`)
      .limit(8),
    supabase
      .from("properties")
      .select("id,property_number,property_type,address,status")
      .eq("community_id", communityId)
      .or(`property_number.ilike.${like},address.ilike.${like}`)
      .limit(8),
    supabase
      .from("businesses")
      .select("id,business_number,name,business_type,status")
      .eq("community_id", communityId)
      .or(`business_number.ilike.${like},name.ilike.${like}`)
      .limit(8),
    supabase
      .from("leo_records")
      .select("id,record_number,record_type,title,status,created_at")
      .eq("community_id", communityId)
      .or(`record_number.ilike.${like},title.ilike.${like}`)
      .limit(8),
    supabase
      .from("leo_warrants")
      .select("id,warrant_number,title,status,priority,issued_at")
      .eq("community_id", communityId)
      .or(`warrant_number.ilike.${like},title.ilike.${like}`)
      .limit(8),
  ]);

  const results = [
    ...(characters.data ?? []).map((item) => ({
      type: "character",
      id: item.id,
      title: `${item.first_name} ${item.last_name}`,
      subtitle: `${item.state_id} · ${item.is_archived ? "Archived" : "Active"}`,
    })),
    ...(vehicles.data ?? []).map((item) => ({
      type: "vehicle",
      id: item.id,
      title: `${item.model_year ?? ""} ${item.make ?? ""} ${item.model ?? ""}`.trim(),
      subtitle: `${item.plate_number} · ${item.vin} · ${item.status}`,
    })),
    ...(weapons.data ?? []).map((item) => ({
      type: "weapon",
      id: item.id,
      title: `${item.make ?? ""} ${item.model ?? ""}`.trim(),
      subtitle: `${item.serial_number} · ${item.registration_number} · ${item.status}`,
    })),
    ...(properties.data ?? []).map((item) => ({
      type: "property",
      id: item.id,
      title: item.address,
      subtitle: `${item.property_number} · ${item.property_type} · ${item.status}`,
    })),
    ...(businesses.data ?? []).map((item) => ({
      type: "business",
      id: item.id,
      title: item.name,
      subtitle: `${item.business_number} · ${item.business_type} · ${item.status}`,
    })),
    ...(records.data ?? []).map((item) => ({
      type: "record",
      id: item.id,
      title: `${item.record_number} — ${item.title}`,
      subtitle: `${item.record_type} · ${item.status} · ${new Date(item.created_at).toLocaleDateString()}`,
    })),
    ...(warrants.data ?? []).map((item) => ({
      type: "warrant",
      id: item.id,
      title: `${item.warrant_number} — ${item.title}`,
      subtitle: `${item.priority} · ${item.status} · ${new Date(item.issued_at).toLocaleDateString()}`,
    })),
  ];

  return NextResponse.json({ results });
}
