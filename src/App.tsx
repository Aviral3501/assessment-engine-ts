import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/pages/Dashboard";
import { SettingsPage } from "@/pages/SettingsPage";
import { QuizSetupPage } from "@/features/quiz/QuizSetupPage";
import {
  QuizRunner,
  type QuizSetup,
} from "@/features/quiz/QuizRunner";
import { SessionReportPage } from "@/features/quiz/SessionReportPage";
import { QuestionBankPage } from "@/features/questions/QuestionBankPage";
import { TopicsPage } from "@/features/topics/TopicsPage";
import { SetsPage } from "@/features/sets/SetsPage";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { FinalReportPage } from "@/features/analytics/FinalReportPage";
import { ImportPage } from "@/features/import-export/ImportPage";
import { Store } from "@/services/store";
import { DEMO_QUESTIONS } from "@/data/demoQuestions";
import type {
  Attempt,
  QuizSession,
} from "@/types/attempt";
import { enableDevToolsProtection } from "@/utils/devtoolsProtection";

export type PageKey =
  | "dashboard"
  | "quiz-setup"
  | "quiz-run"
  | "quiz-report"
  | "bank"
  | "topics"
  | "sets"
  | "analytics"
  | "report"
  | "import"
  | "settings";

interface SessionResult {
  sessionRecord: QuizSession;
  attempts: Attempt[];
}

export default function App() {
  const [page, setPage] =
    useState<PageKey>("dashboard");

  const [ready, setReady] =
    useState(false);

  const [hasData, setHasData] =
    useState(false);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [activeSession, setActiveSession] =
    useState<QuizSetup | null>(null);

  const [sessionResult, setSessionResult] =
    useState<SessionResult | null>(null);

  const [counts, setCounts] = useState({
    questionCount: 0,
    due: 0,
  });

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshKey]);

  useEffect(() => {
  return enableDevToolsProtection();
}, []);

  async function init() {
    const n =
      await Store.questionCount();

    setHasData(n > 0);
    setReady(true);

    refreshCounts();
  }

  async function refreshCounts() {
    const [n, ls] =
      await Promise.all([
        Store.questionCount(),
        Store.allLearningStates(),
      ]);

    setCounts({
      questionCount: n,
      due: ls.filter(
        (l) => l.state === "due"
      ).length,
    });

    setHasData(n > 0);
  }

  async function loadDemo() {
    await Store.importQuestions(
      DEMO_QUESTIONS,
      "skip",
      new Set()
    );

    setRefreshKey(
      (k) => k + 1
    );

    setPage("dashboard");
  }

  function bump() {
    setRefreshKey(
      (k) => k + 1
    );
  }

  function startQuiz(
    setup: QuizSetup
  ) {
    setActiveSession(setup);
    setSessionResult(null);
    setPage("quiz-run");
  }

  function finishQuiz(
    sessionRecord: QuizSession,
    attempts: Attempt[]
  ) {
    setSessionResult({
      sessionRecord,
      attempts,
    });

    setActiveSession(null);
    setPage("quiz-report");
    bump();
  }

  if (!ready) return null;

  if (
    !hasData &&
    page !== "import" &&
    page !== "quiz-run"
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="fade-in text-center max-w-[420px]">
          <div className="text-2xl font-bold mb-2">
            Welcome to your Quiz System.
          </div>

          <div className="text-[13.5px] text-textMuted mb-6">
            Import your question bank to begin.
            Everything stays on this device.
          </div>

          <div className="flex gap-2.5 justify-center">
            <button
              className="btn btn-primary"
              onClick={() =>
                setPage("import")
              }
            >
              Import Questions
            </button>

            <button
              className="btn"
              onClick={loadDemo}
            >
              View Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  let content: React.ReactNode = null;

  if (page === "dashboard") {
    content = (
      <Dashboard
        setPage={setPage}
        refreshKey={refreshKey}
      />
    );
  } else if (page === "quiz-setup") {
    content = (
      <QuizSetupPage
        onStart={startQuiz}
      />
    );
  } else if (page === "quiz-run") {
    content = activeSession ? (
      <QuizRunner
        session={activeSession}
        onFinish={finishQuiz}
      />
    ) : (
      <QuizSetupPage
        onStart={startQuiz}
      />
    );
  } else if (page === "quiz-report") {
    content = sessionResult ? (
      <SessionReportPage
        sessionRecord={
          sessionResult.sessionRecord
        }
        attempts={
          sessionResult.attempts
        }
        setPage={setPage}
      />
    ) : null;
  } else if (page === "bank") {
    content = (
      <QuestionBankPage
        key={refreshKey}
      />
    );
  } else if (page === "topics") {
    content = (
      <TopicsPage
        key={refreshKey}
      />
    );
  } else if (page === "sets") {
    content = (
      <SetsPage
        key={refreshKey}
        onSolve={startQuiz}
      />
    );
  } else if (page === "analytics") {
    content = (
      <AnalyticsPage
        refreshKey={refreshKey}
      />
    );
  } else if (page === "report") {
    content = (
      <FinalReportPage
        refreshKey={refreshKey}
      />
    );
  } else if (page === "import") {
    content = (
      <ImportPage
        onImported={bump}
      />
    );
  } else if (page === "settings") {
    content = (
      <SettingsPage
        onDataChanged={bump}
      />
    );
  }

  const sidebarPage: PageKey =
    page === "quiz-run" ||
    page === "quiz-report"
      ? "quiz-setup"
      : page;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        page={sidebarPage}
        setPage={setPage}
        counts={counts}
      />

      <div className="flex-1 p-[26px] px-8 overflow-auto">
        {content}
      </div>
    </div>
  );
}