"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./written-test.module.css";

type Question = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

type Props = {
  applicationId: string;
  alreadyPassed: boolean;
  questions: Question[];
  characterName: string;
  stateId: string;
  loadError?: string;
  timeLimitMinutes?: number;
};

export default function WrittenTestClient({
  applicationId,
  alreadyPassed,
  questions,
  characterName,
  stateId,
  loadError = "",
  timeLimitMinutes = 20,
}: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(loadError);
  const [secondsLeft, setSecondsLeft] = useState(timeLimitMinutes * 60);
  const [result, setResult] = useState<{score:number;passed:boolean}|null>(
    alreadyPassed ? { score:100, passed:true } : null
  );

  const answered = useMemo(
    () => questions.filter(q => answers[q.id]).length,
    [answers, questions]
  );

  useEffect(() => {
    if (result || !questions.length) return;
    const timer = window.setInterval(() => {
      setSecondsLeft(value => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [result, questions.length]);

  useEffect(() => {
    if (secondsLeft === 0 && !result && questions.length) {
      void submit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const current = questions[index];
  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2,"0");
  const seconds = (secondsLeft % 60).toString().padStart(2,"0");

  async function submit() {
    if (busy) return;
    if (answered !== questions.length && secondsLeft > 0) {
      setError("Answer every question before submitting.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/licenses/tests/written", {
        method:"POST",
        headers:{ "content-type":"application/json" },
        body:JSON.stringify({ applicationId, answers }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Test submission failed.");

      setResult({ score:Number(body.score || 0), passed:Boolean(body.passed) });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test submission failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!questions.length || !current) {
    return (
      <section className={styles.result}>
        <AlertTriangle size={48} />
        <h2>Exam unavailable</h2>
        <p>{loadError || "No questions are configured for this licence type."}</p>
        <Link href="/licenses" className={styles.button}>Return to licences</Link>
      </section>
    );
  }

  if (result) {
    return (
      <section className={styles.result}>
        {result.passed ? <CheckCircle2 size={52}/> : <AlertTriangle size={52}/>}
        <span className={styles.eyebrow}>{result.passed ? "Exam passed" : "Exam failed"}</span>
        <h2>{result.score.toFixed(0)}%</h2>
        <p>
          {result.passed
            ? "Your written requirement is complete."
            : "A passing score is 80%. Review the material and apply for a retake."}
        </p>
        <Link href="/licenses" className={styles.button}>Return to licences</Link>
      </section>
    );
  }

  const options = [
    ["A",current.option_a],["B",current.option_b],["C",current.option_c],["D",current.option_d],
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Official written examination</span>
          <h2>{characterName}</h2>
          <p>{stateId} · {answered}/{questions.length} answered</p>
        </div>
        <div className={styles.timer}>
          <Clock3 size={18}/>
          <strong>{minutes}:{seconds}</strong>
          <span>time remaining</span>
        </div>
      </section>

      <div className={styles.progressTrack}>
        <span style={{ width:`${(answered/questions.length)*100}%` }}/>
      </div>

      <section className={styles.card}>
        <span className={styles.questionNumber}>Question {index+1} of {questions.length}</span>
        <h3>{current.question}</h3>

        <div className={styles.options}>
          {options.map(([letter,label]) => (
            <button
              key={letter}
              type="button"
              className={`${styles.option} ${answers[current.id]===letter ? styles.optionSelected : ""}`}
              onClick={() => setAnswers(prev => ({...prev,[current.id]:letter}))}
            >
              <span className={styles.letter}>{letter}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.button} ${styles.secondary}`}
            disabled={index===0}
            onClick={() => setIndex(v => v-1)}
          >
            <ChevronLeft size={17}/> Previous
          </button>

          {index < questions.length-1 ? (
            <button type="button" className={styles.button} onClick={() => setIndex(v => v+1)}>
              Next <ChevronRight size={17}/>
            </button>
          ) : (
            <button type="button" className={styles.button} disabled={busy} onClick={submit}>
              {busy ? "Scoring…" : "Submit exam"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
