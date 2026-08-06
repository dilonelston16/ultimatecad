import { AppShell } from "@/components/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WrittenTestClient from "./written-test-client";

type Question = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  sort_order: number;
};

export default async function WrittenLicenseTestPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/licenses/tests/${applicationId}`);

  const { data: application, error: applicationError } = await supabase
    .from("license_applications")
    .select("id,status,written_status,character_id,license_type_id,application_number,license_type:license_types(name,code),character:characters(first_name,last_name,state_id,owner_user_id)")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError || !application) {
    return (
      <AppShell title="Written License Test" subtitle="Application unavailable">
        <section className="written-test-empty">
          <h2>Application could not be loaded</h2>
          <p>{applicationError?.message ?? "This application is unavailable."}</p>
          <a href="/licenses" className="button">Return to licenses</a>
        </section>
      </AppShell>
    );
  }

  const characterRaw = application.character;
  const character = Array.isArray(characterRaw) ? characterRaw[0] : characterRaw;
  if (!character || character.owner_user_id !== user.id) redirect("/licenses");
  if (application.written_status === "not_required") redirect("/licenses");

  let questions: Question[] = [];
  let questionError = "";

  const { data: rpcQuestions, error: rpcError } = await supabase.rpc(
    "get_written_license_test_questions",
    { p_application_id: applicationId }
  );

  if (!rpcError && Array.isArray(rpcQuestions) && rpcQuestions.length > 0) {
    questions = rpcQuestions as Question[];
  } else {
    const { data: fallbackQuestions, error: fallbackError } = await supabase
      .from("license_test_questions")
      .select("id,question,option_a,option_b,option_c,option_d,sort_order")
      .eq("license_type_id", application.license_type_id)
      .eq("active", true)
      .order("sort_order")
      .limit(15);

    if (!fallbackError && fallbackQuestions?.length) {
      questions = fallbackQuestions as Question[];
      questionError = rpcError
        ? "Randomized test service unavailable; loaded the standard question set."
        : "";
    } else {
      questionError =
        fallbackError?.message ??
        rpcError?.message ??
        "No written-test questions are configured for this license type.";
    }
  }

  const typeRaw = application.license_type;
  const licenseType = Array.isArray(typeRaw) ? typeRaw[0] : typeRaw;

  return (
    <AppShell
      title="Written License Test"
      subtitle={`${licenseType?.name ?? "License"} · ${application.application_number}`}
    >
      {questionError && questions.length > 0 ? (
        <div className="status-banner">{questionError}</div>
      ) : null}

      <WrittenTestClient
        applicationId={application.id}
        alreadyPassed={application.written_status === "passed"}
        questions={questions}
        characterName={`${character.first_name} ${character.last_name}`}
        stateId={character.state_id}
        loadError={questions.length === 0 ? questionError : ""}
      />
    </AppShell>
  );
}
