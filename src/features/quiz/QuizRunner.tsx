import { useEffect, useRef, useState } from "react";
import type { Question, QuestionResponse } from "@/types/question";
import type { AnswerRevealMode, Attempt, QuizMode, QuizSession } from "@/types/attempt";
import { Store } from "@/services/store";
import { db } from "@/db/db";
import { uid, nowISO } from "@/utils/id";
import { QuestionRenderer } from "./QuestionRenderer";
import { AnswerReview } from "./AnswerReview";
import { TypeBadge, DifficultyBadge } from "@/components/Badges";
import { CodeBlock } from "@/components/CodeBlock";

export interface QuizSetup {
  mode: QuizMode;
  questions: Question[];
  revealMode: AnswerRevealMode;
}

interface Props {
  session: QuizSetup;
  onFinish: (sessionRecord: QuizSession, attempts: Attempt[]) => void;
}

export function QuizRunner({ session, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [attemptsLog, setAttemptsLog] = useState<Attempt[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [startTime] = useState(Date.now());
  const sessionIdRef = useRef(uid("qs"));
  const qStartRef = useRef(Date.now());

  useEffect(() => {
    Store.allBookmarks().then((bm) => setBookmarks(new Set(bm.map((b) => b.question_id))));
  }, []);
  useEffect(() => {
    qStartRef.current = Date.now();
  }, [idx]);

  const q = session.questions[idx];
  const isLast = idx === session.questions.length - 1;
  const response = responses[q.id];
  const isRevealed = session.revealMode === "immediate" ? !!revealed[q.id] : false;

  function setResponse(val: QuestionResponse) {
    setResponses((r) => ({ ...r, [q.id]: val }));
  }

  async function submit() {
    if (session.revealMode === "immediate" && !revealed[q.id]) {
      const timeTaken = Math.round((Date.now() - qStartRef.current) / 1000);
      const attempt = await Store.recordAttempt({ question: q, quiz_session_id: sessionIdRef.current, selected_answers: response, timeTakenSec: timeTaken });
      setAttemptsLog((l) => [...l, attempt]);
      setRevealed((r) => ({ ...r, [q.id]: true }));
      return;
    }
    void goNext();
  }

  async function goNext() {
    if (session.revealMode === "end" && !attemptsLog.find((a) => a.question_id === q.id)) {
      const timeTaken = Math.round((Date.now() - qStartRef.current) / 1000);
      const attempt = await Store.recordAttempt({ question: q, quiz_session_id: sessionIdRef.current, selected_answers: response, timeTakenSec: timeTaken });
      setAttemptsLog((l) => [...l, attempt]);
    }
    if (isLast) {
      await finish();
      return;
    }
    setIdx((i) => i + 1);
  }

  async function finish() {
    const correct = attemptsLog.filter((a) => a.result === "correct").length;
    const partial = attemptsLog.filter((a) => a.result === "partial").length;
    const incorrect = attemptsLog.filter((a) => a.result === "incorrect").length;
    const sessionRecord: QuizSession = {
      quiz_session_id: sessionIdRef.current,
      started_at: new Date(startTime).toISOString(),
      completed_at: nowISO(),
      mode: session.mode,
      question_ids: session.questions.map((qq) => qq.id),
      total_questions: session.questions.length,
      answered_questions: attemptsLog.length,
      correct_questions: correct,
      partial_questions: partial,
      incorrect_questions: incorrect,
      score: attemptsLog.length ? (correct + partial * 0.5) / attemptsLog.length : 0,
      duration: Math.round((Date.now() - startTime) / 1000),
    };
    await db.quiz_sessions.put(sessionRecord);
    onFinish(sessionRecord, attemptsLog);
  }

  async function toggleBookmark() {
    await Store.toggleBookmark(q.id);
    const bm = await Store.allBookmarks();
    setBookmarks(new Set(bm.map((b) => b.question_id)));
  }
  async function flagQuestion() {
    const reason = window.prompt("Flag reason (confusing / questionable / difficult / error / revisit):", "revisit");
    if (reason) await Store.addFlag(q.id, reason);
  }

  const currentAttempt = attemptsLog.find((a) => a.question_id === q.id);

  return (
    <div className="fade-in max-w-3xl">
      <div className="flex justify-between items-center mb-3.5">
        <div className="text-[13px] text-textMuted">
          Question {idx + 1} / {session.questions.length}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={toggleBookmark}>
            {bookmarks.has(q.id) ? "★ Bookmarked" : "☆ Bookmark"}
          </button>
          <button className="btn btn-sm" onClick={flagQuestion}>
            ⚑ Flag
          </button>
        </div>
      </div>

      <div className="bar-track mb-4">
        <div className="bar-fill" style={{ width: `${((idx + 1) / session.questions.length) * 100}%`, background: "#4FA3E3" }} />
      </div>

      <div className="flex gap-2 mb-2.5 flex-wrap">
        <span className="pill bg-surface2 text-textMuted">{q.category}</span>
        {q.subcategory && <span className="pill bg-surface2 text-textMuted">{q.subcategory}</span>}
        <span className="pill bg-surface2 text-textMuted">{q.topic}</span>
        <TypeBadge type={q.question_type} />
        <DifficultyBadge difficulty={q.difficulty} />
        {q.question_type === "best_answer" && <span className="pill bg-accentDim text-accent">Best Answer</span>}
      </div>

      <div className="card p-5">
        <div className="text-[15.5px] leading-relaxed mb-1.5">{q.question.text}</div>
        {q.question.code && <QuestionRendererCode code={q.question.code} tags={q.tags} />}

        <div className="mt-4">
          <QuestionRenderer question={q} response={response} setResponse={setResponse} disabled={isRevealed} />
        </div>

        {!isRevealed && (
          <button className="btn btn-primary mt-4.5" onClick={submit}>
            Submit Answer
          </button>
        )}

        {isRevealed && currentAttempt && <AnswerReview question={q} attempt={currentAttempt} />}
      </div>

      <div className="flex justify-between mt-4">
        <button className="btn" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          ← Previous
        </button>
        <div className="flex gap-2">
          <button className="btn" onClick={goNext}>
            {isLast ? "Skip & Finish" : "Skip →"}
          </button>
          {(isRevealed || session.revealMode === "end") && (
            <button className="btn btn-primary" onClick={isLast ? finish : goNext}>
              {isLast ? "Finish Quiz" : "Next →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionRendererCode({ code, tags }: { code: string; tags?: string[] }) {
  const language = tags?.includes("python") ? "python" : "sql";
  return <CodeBlock code={code} language={language} />;
}
