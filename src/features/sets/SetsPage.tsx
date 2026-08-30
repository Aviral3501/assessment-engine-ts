import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  QuestionSet,
  QuestionSetFolder,
} from "@/types/questionSet";
import { Store } from "@/services/store";
import { safeAccuracy } from "@/services/analytics";
import { EmptyState, Pct } from "@/components/Primitives";
import type { QuizSetup } from "@/features/quiz/QuizRunner";
import { randomizeQuestionOptions } from "@/services/quizPreparation";

export function SetsPage({
  onSolve,
}: {
  onSolve: (setup: QuizSetup) => void;
}) {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [folders, setFolders] = useState<
    QuestionSetFolder[]
  >([]);

  const [stats, setStats] = useState<
    Record<
      string,
      {
        attempted: number;
        accuracy: number | null;
      }
    >
  >({});

  const [loading, setLoading] =
    useState(true);

  const [expandedFolders, setExpandedFolders] =
    useState<Set<string>>(new Set());

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);

    const [
      allSets,
      allFolders,
      attempts,
    ] = await Promise.all([
      Store.allQuestionSets(),
      Store.allQuestionSetFolders(),
      Store.allAttempts(),
    ]);

    setSets(allSets);
    setFolders(allFolders);

    const s: Record<
      string,
      {
        attempted: number;
        accuracy: number | null;
      }
    > = {};

    allSets.forEach((set) => {
      const idSet = new Set(
        set.question_ids
      );

      const relevant = attempts.filter(
        (a) =>
          idSet.has(a.question_id)
      );

      const attemptedIds = new Set(
        relevant.map(
          (a) => a.question_id
        )
      );

      const correct =
        relevant.filter(
          (a) => a.result === "correct"
        ).length;

      const partial =
        relevant.filter(
          (a) => a.result === "partial"
        ).length;

      s[set.id] = {
        attempted:
          attemptedIds.size,
        accuracy: safeAccuracy(
          correct,
          partial,
          relevant.length
        ),
      };
    });

    setStats(s);
    setLoading(false);
  }

  async function solveSet(
    set: QuestionSet
  ) {
    const questions =
      await Store.getQuestionsForSet(
        set.id
      );

    if (!questions.length) {
      window.alert(
        "This set's questions are no longer in the question bank."
      );
      return;
    }

    const randomizedQuestions =
      randomizeQuestionOptions(
        questions
      );

    onSolve({
      mode: "set",
      questions:
        randomizedQuestions,
      revealMode: "immediate",
    });
  }

  async function removeSet(
    set: QuestionSet
  ) {
    if (
      !window.confirm(
        `Remove the set "${set.name}"? The questions themselves stay in your question bank — only this set grouping is deleted.`
      )
    ) {
      return;
    }

    await Store.deleteQuestionSet(
      set.id
    );

    await load();
  }

  function toggleFolder(
    folderId: string
  ) {
    setExpandedFolders((current) => {
      const next = new Set(
        current
      );

      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }

      return next;
    });
  }

  async function createFolder(
    parentId: string | null
  ) {
    const name = window.prompt(
      parentId
        ? "Folder name:"
        : "Root folder name:"
    );

    if (!name?.trim()) {
      return;
    }

    try {
      await Store.createQuestionSetFolder(
        name,
        parentId
      );

      await load();

      if (parentId) {
        setExpandedFolders(
          (current) =>
            new Set([
              ...current,
              parentId,
            ])
        );
      }
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to create folder."
      );
    }
  }

  async function renameFolder(
    folder: QuestionSetFolder
  ) {
    const name = window.prompt(
      "New folder name:",
      folder.name
    );

    if (!name?.trim()) {
      return;
    }

    try {
      await Store.renameQuestionSetFolder(
        folder.id,
        name
      );

      await load();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to rename folder."
      );
    }
  }

  async function moveFolder(
    folder: QuestionSetFolder
  ) {
    const destinations =
      folders.filter(
        (candidate) =>
          candidate.id !==
            folder.id &&
          !isDescendant(
            candidate.id,
            folder.id,
            folders
          )
      );

    const options = [
      "ROOT",
      ...destinations.map(
        (destination) =>
          destination.id
      ),
    ];

    const labels = [
      "Root",
      ...destinations.map(
        (destination) =>
          getFolderPath(
            destination.id,
            folders
          )
      ),
    ];

    const selection =
      window.prompt(
        `Move "${folder.name}" to:\n\n${labels
          .map(
            (label, index) =>
              `${index + 1}. ${label}`
          )
          .join(
            "\n"
          )}\n\nEnter the number:`,
        "1"
      );

    if (!selection) {
      return;
    }

    const selectedIndex =
      Number(selection) - 1;

    if (
      !Number.isInteger(
        selectedIndex
      ) ||
      selectedIndex < 0 ||
      selectedIndex >=
        options.length
    ) {
      window.alert(
        "Invalid folder destination."
      );
      return;
    }

    const selected =
      options[selectedIndex];

    try {
      await Store.moveQuestionSetFolder(
        folder.id,
        selected === "ROOT"
          ? null
          : selected
      );

      await load();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to move folder."
      );
    }
  }

  async function deleteFolder(
    folder: QuestionSetFolder
  ) {
    const hasSets =
      sets.some(
        (set) =>
          set.folder_id ===
          folder.id
      );

    const hasChildren =
      folders.some(
        (child) =>
          child.parent_id ===
          folder.id
      );

    const message =
      hasSets || hasChildren
        ? `Delete the folder "${folder.name}"?\n\nSets inside will be moved to Root and child folders will also be moved to Root. Nothing from your question bank will be deleted.`
        : `Delete the folder "${folder.name}"?`;

    if (
      !window.confirm(message)
    ) {
      return;
    }

    try {
      await Store.deleteQuestionSetFolder(
        folder.id
      );

      setExpandedFolders(
        (current) => {
          const next = new Set(
            current
          );
          next.delete(folder.id);
          return next;
        }
      );

      await load();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to delete folder."
      );
    }
  }

  async function moveSet(
    set: QuestionSet
  ) {
    const destinations = [
      {
        id: null,
        label: "Root",
      },
      ...folders.map(
        (folder) => ({
          id: folder.id,
          label: getFolderPath(
            folder.id,
            folders
          ),
        })
      ),
    ];

    const currentFolderId =
      set.folder_id ??
      null;

    const labels =
      destinations.map(
        (destination) =>
          destination.label
      );

    const selection =
      window.prompt(
        `Move "${set.name}" to:\n\n${labels
          .map(
            (label, index) =>
              `${index + 1}. ${label}`
          )
          .join(
            "\n"
          )}\n\nEnter the number:`,
        String(
          Math.max(
            1,
            destinations.findIndex(
              (destination) =>
                destination.id ===
                currentFolderId
            ) + 1
          )
        )
      );

    if (!selection) {
      return;
    }

    const selectedIndex =
      Number(selection) - 1;

    if (
      !Number.isInteger(
        selectedIndex
      ) ||
      selectedIndex < 0 ||
      selectedIndex >=
        destinations.length
    ) {
      window.alert(
        "Invalid folder destination."
      );
      return;
    }

    const destination =
      destinations[selectedIndex];

    try {
      await Store.moveQuestionSetToFolder(
        set.id,
        destination.id
      );

      await load();

      if (destination.id) {
        setExpandedFolders(
          (current) =>
            new Set([
              ...current,
              destination.id!,
            ])
        );
      }
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to move set."
      );
    }
  }

  const rootSets = useMemo(
    () =>
      sets.filter(
        (set) =>
          !set.folder_id
      ),
    [sets]
  );

  const rootFolders = useMemo(
    () =>
      folders.filter(
        (folder) =>
          folder.parent_id ===
          null
      ),
    [folders]
  );

  function renderSet(
    set: QuestionSet,
    depth: number
  ) {
    const st = stats[set.id];

    return (
      <div
        key={set.id}
        className="card p-4 flex items-center justify-between gap-4"
        style={{
          marginLeft:
            depth * 20,
        }}
      >
        <div className="min-w-0">
          <div className="text-[14px] font-semibold truncate">
            {set.name}
          </div>

          <div className="flex gap-4 text-[11.5px] text-textMuted mt-1 flex-wrap">
            <span>
              {set.count} questions
            </span>

            <span>
              Uploaded{" "}
              {new Date(
                set.imported_at
              ).toLocaleDateString()}
            </span>

            <span>
              {st
                ? `${st.attempted}/${set.count} attempted`
                : "—"}
            </span>

            <span>
              Accuracy:{" "}
              <Pct
                value={
                  st?.accuracy ?? null
                }
              />
            </span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <button
            className="btn btn-sm"
            onClick={() =>
              void moveSet(set)
            }
          >
            Move
          </button>

          <button
            className="btn btn-sm btn-danger"
            onClick={() =>
              void removeSet(set)
            }
          >
            Remove
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() =>
              void solveSet(set)
            }
          >
            Solve Set →
          </button>
        </div>
      </div>
    );
  }

function renderFolder(
  folder: QuestionSetFolder,
  depth: number
): ReactNode {
    const children =
      folders.filter(
        (candidate) =>
          candidate.parent_id ===
          folder.id
      );

    const childSets =
      sets.filter(
        (set) =>
          set.folder_id ===
          folder.id
      );

    const expanded =
      expandedFolders.has(
        folder.id
      );

    const totalItems =
      children.length +
      childSets.length;

    return (
      <div
        key={folder.id}
        className="flex flex-col gap-2"
        style={{
          marginLeft:
            depth * 20,
        }}
      >
        <div className="card p-3 flex items-center justify-between gap-3">
          <button
            type="button"
            className="flex items-center gap-2 min-w-0 bg-transparent border-none p-0 cursor-pointer text-left"
            onClick={() =>
              toggleFolder(folder.id)
            }
          >
            <span className="text-textMuted text-sm">
              {expanded
                ? "▾"
                : "▸"}
            </span>

            <span className="text-[14px]">
              📁
            </span>

            <span className="font-semibold truncate">
              {folder.name}
            </span>

            <span className="text-[11px] text-textDim">
              ({totalItems})
            </span>
          </button>

          <div className="flex gap-1.5 shrink-0">
            <button
              className="btn btn-sm"
              onClick={() =>
                void createFolder(
                  folder.id
                )
              }
            >
              + Folder
            </button>

            <button
              className="btn btn-sm"
              onClick={() =>
                void renameFolder(
                  folder
                )
              }
            >
              Rename
            </button>

            <button
              className="btn btn-sm"
              onClick={() =>
                void moveFolder(
                  folder
                )
              }
            >
              Move
            </button>

            <button
              className="btn btn-sm btn-danger"
              onClick={() =>
                void deleteFolder(
                  folder
                )
              }
            >
              Delete
            </button>
          </div>
        </div>

        {expanded && (
          <div className="flex flex-col gap-2">
            {children.map(
              (child) =>
                renderFolder(
                  child,
                  depth + 1
                )
            )}

            {childSets.map(
              (set) =>
                renderSet(
                  set,
                  depth + 1
                )
            )}

            {totalItems === 0 && (
              <div
                className="text-[11.5px] text-textDim py-2"
                style={{
                  marginLeft: 24,
                }}
              >
                Empty folder
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return null;
  }

  if (
    sets.length === 0 &&
    folders.length === 0
  ) {
    return (
      <div className="fade-in">
        <div className="flex items-center justify-between mb-1">
          <div className="text-lg font-bold">
            Sets
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() =>
              void createFolder(null)
            }
          >
            + New Folder
          </button>
        </div>

        <div className="text-[12.5px] text-textMuted mb-4">
          Each uploaded batch starts in Root. Organize
          sets into folders whenever you want.
        </div>

        <EmptyState
          title="No sets yet."
          body="Every batch you import is saved here automatically in Root, ready to be organized into folders."
        />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-1">
        <div className="text-lg font-bold">
          Sets
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() =>
            void createFolder(null)
          }
        >
          + New Folder
        </button>
      </div>

      <div className="text-[12.5px] text-textMuted mb-4">
        Every uploaded batch starts in Root. You can
        organize sets into nested folders without changing
        the underlying question sets.
      </div>

      <div className="flex flex-col gap-2">
        {rootFolders.map(
          (folder) =>
            renderFolder(
              folder,
              0
            )
        )}

        {rootSets.map(
          (set) =>
            renderSet(
              set,
              0
            )
        )}
      </div>
    </div>
  );
}

/**
 * Returns true when candidateId is the same as ancestorId
 * or exists somewhere underneath ancestorId.
 */
function isDescendant(
  candidateId: string,
  ancestorId: string,
  folders: QuestionSetFolder[]
): boolean {
  let current: QuestionSetFolder | undefined =
    folders.find(
      (folder) =>
        folder.id === candidateId
    );

  while (current) {
    if (
      current.parent_id ===
      ancestorId
    ) {
      return true;
    }

    current =
      current.parent_id
        ? folders.find(
            (folder) =>
              folder.id ===
              current!.parent_id
          )
        : undefined;
  }

  return false;
}

/**
 * Builds a human-readable folder path:
 *
 * Root / Snowflake / Advanced
 */
function getFolderPath(
  folderId: string,
  folders: QuestionSetFolder[]
): string {
  const parts: string[] = [];

  let current:
    | QuestionSetFolder
    | undefined =
    folders.find(
      (folder) =>
        folder.id === folderId
    );

  while (current) {
    parts.unshift(
      current.name
    );

    current =
      current.parent_id
        ? folders.find(
            (folder) =>
              folder.id ===
              current!.parent_id
          )
        : undefined;
  }

  return `Root / ${parts.join(
    " / "
  )}`;
}