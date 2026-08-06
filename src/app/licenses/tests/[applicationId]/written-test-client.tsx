"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Question = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  sort_order: number;
};

type Props = {
  applicationId: string;
  alreadyPassed: boolean;
  questions: Question[];
  characterName: string;
  stateId: string;
  loadError?: string;
};

export default function WrittenTestClient({
  applicationId,
  alreadyPassed,
  questions,
  characterName,
  stateId,
  loadError = "",
}: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(
    alreadyPassed ? { score: 100, passed: true } : null
  );
  const [error, setError] = useState(loadError);

  const answered = useMemo(
    () => questions.filter((question) => answers[question.id]).length,
    [answers, questions]
  );

  const current = questions[index];

  async function submit() {
    if (answered !== questions.length) {
      setError("Answer every question before submitting the test.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/licenses/tests/written", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId, answers }),
      });

      const text = await response.text();
      let body: any = {};
      try { body = text ? JSON.parse(text) : {}; } catch {}

      if (!response.ok) {
        throw new Error(body.error || `The written test could not be submitted (${response.status}).`);
      }

      setResult({
        score: Number(body.score ?? 0),
        passed: Boolean(body.passed),
      });
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The written test could not be submitted."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!questions.length || !current) {
    return (
      <section className="written-test-empty">
        <AlertTriangle />
        <h2>Written test unavailable</h2>
        <p>{loadError || "No questions are configured for this license type."}</p>
        <Link href="/licenses" className="button">Return to licenses</Link>
      </section>
    );
  }

  if (result) {
    return (
      <section className={`written-test-result ${result.passed ? "passed" : "failed"}`}>
        {result.passed ? <CheckCircle2 /> : <AlertTriangle />}
        <span className="eyebrow">{result.passed ? "TEST PASSED" : "TEST FAILED"}</span>
        <h2>{result.score.toFixed(0)}%</h2>
        <p>
          {result.passed
            ? "Your written requirement is complete."
            : "A passing score is 80%. Review the material and retake the test."}
        </p>
        <div className="written-result-actions">
          {!result.passed && (
            <button
              className="button"
              onClick={() => {
                setAnswers({});
                setIndex(0);
                setResult(null);
                setError("");
              }}
            >
              Retake test
            </button>
          )}
          <Link href="/licenses" className="button ghost">Return to licenses</Link>
        </div>
      </section>
    );
  }

  const options = [
    ["A", current.option_a],
    ["B", current.option_b],
    ["C", current.option_c],
    ["D", current.option_d],
  ];

  return (
    <div className="written-test-page">
      <section className="written-test-header">
        <div>
          <span className="eyebrow">Official written exam</span>
          <h2>{characterName}</h2>
          <p>{stateId}</p>
        </div>
        <div className="written-progress-copy">
          <strong>{answered}/{questions.length}</strong>
          <span>answered</span>
        </div>
      </section>

      <div className="written-progress-track">
        <span style={{ width: `${(answered / questions.length) * 100}%` }} />
      </div>

      <section className="panel written-question-card">
        <span className="question-number">
          Question {index + 1} of {questions.length}
        </span>
        <h2>{current.question}</h2>

        <div className="written-options">
          {options.map(([letter, label]) => (
            <button
              type="button"
              key={letter}
              className={answers[current.id] === letter ? "selected" : ""}
              onClick={() =>
                setAnswers((previous) => ({ ...previous, [current.id]: letter }))
              }
            >
              <b>{letter}</b>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="written-test-nav">
          <button
            type="button"
            className="button ghost"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            <ChevronLeft size={17} /> Previous
          </button>

          {index < questions.length - 1 ? (
            <button
              type="button"
              className="button"
              onClick={() => setIndex((value) => value + 1)}
            >
              Next <ChevronRight size={17} />
            </button>
          ) : (
            <button type="button" className="button" disabled={busy} onClick={submit}>
              {busy ? "Scoring…" : "Submit test"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
