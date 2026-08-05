import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WrittenTestClient from "./written-test-client";

export default async function WrittenLicenseTestPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/licenses/tests/${applicationId}`);

  const { data: application } = await supabase
    .from("license_applications")
    .select(
      "id,status,written_status,character_id,license_type_id,application_number,license_type:license_types(name,code),character:characters(first_name,last_name,state_id,owner_user_id)"
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (!application) redirect("/licenses");

  const characterRaw = application.character;
  const character = Array.isArray(characterRaw) ? characterRaw[0] : characterRaw;
  if (!character || character.owner_user_id !== user.id) redirect("/licenses");
  if (application.written_status === "not_required") redirect("/licenses");

  const { data: questions, error } = await supabase.rpc(
    "get_written_license_test_questions",
    { p_application_id: applicationId }
  );

  if (error) {
    throw new Error(error.message);
  }

  const typeRaw = application.license_type;
  const licenseType = Array.isArray(typeRaw) ? typeRaw[0] : typeRaw;

  return (
    <AppShell
      title="Written License Test"
      subtitle={`${licenseType?.name ?? "License"} · ${application.application_number}`}
    >
      <WrittenTestClient
        applicationId={application.id}
        alreadyPassed={application.written_status === "passed"}
        questions={questions ?? []}
        characterName={`${character.first_name} ${character.last_name}`}
        stateId={character.state_id}
      />
    </AppShell>
  );
}
