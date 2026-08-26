import type { Question, QuestionResponse } from "@/types/question";

interface Props {
  question: Question;
  response: QuestionResponse;
  setResponse: (val: QuestionResponse) => void;
  disabled?: boolean;
}

export function QuestionRenderer({ question, response, setResponse, disabled }: Props) {
  const type = question.question_type;
  const opts = question.options ?? [];

  if (type === "single_choice" || type === "best_answer" || type === "true_false") {
    return (
      <div className="flex flex-col gap-2">
        {opts.map((o) => {
          const active = String(response) === String(o.id);
          return (
            <label
              key={o.id}
              className="flex gap-2.5 items-start px-3 py-2.5 rounded-md border cursor-pointer"
              style={{ borderColor: active ? "#4FA3E3" : "#29333B", background: active ? "#1C242B" : "transparent" }}
            >
              <input
                type="radio"
                name={question.id}
                disabled={disabled}
                checked={active}
                onChange={() => setResponse(o.id)}
                className="mt-0.5"
              />
              <span className="text-sm">{o.text}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (type === "multiple_choice") {
    const sel = (Array.isArray(response) ? response : []) as string[];
    return (
      <div className="flex flex-col gap-2">
        {opts.map((o) => {
          const checked = sel.map(String).includes(String(o.id));
          return (
            <label
              key={o.id}
              className="flex gap-2.5 items-start px-3 py-2.5 rounded-md border cursor-pointer"
              style={{ borderColor: checked ? "#4FA3E3" : "#29333B", background: checked ? "#1C242B" : "transparent" }}
            >
              <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                onChange={() => {
                  const next = checked ? sel.filter((x) => String(x) !== String(o.id)) : [...sel, String(o.id)];
                  setResponse(next);
                }}
                className="mt-0.5"
              />
              <span className="text-sm">{o.text}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (type === "short_answer") {
    return (
      <input
        className="input"
        disabled={disabled}
        value={(response as string) || ""}
        placeholder="Type your answer…"
        onChange={(e) => setResponse(e.target.value)}
      />
    );
  }

  if (type === "numerical") {
    return (
      <input
        className="input"
        type="number"
        disabled={disabled}
        value={response === undefined || response === null ? "" : (response as number)}
        placeholder="Enter a number…"
        onChange={(e) => setResponse(e.target.value === "" ? null : Number(e.target.value))}
      />
    );
  }

  if (type === "ordering") {
    const order = Array.isArray(response) && response.length ? (response as string[]) : opts.map((o) => String(o.id));
    const move = (i: number, dir: number) => {
      const next = order.slice();
      const j = i + dir;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      setResponse(next);
    };
    return (
      <div className="flex flex-col gap-1.5">
        {order.map((id, i) => {
          const opt = opts.find((o) => String(o.id) === String(id));
          return (
            <div key={id} className="flex items-center gap-2.5 px-2.5 py-2 border border-border rounded-md">
              <span className="mono text-textDim text-xs">{i + 1}</span>
              <span className="flex-1 text-sm">{opt ? opt.text : id}</span>
              {!disabled && (
                <div className="flex gap-1">
                  <button type="button" className="btn btn-sm" onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => move(i, 1)}>
                    ↓
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (type === "matching") {
    const pairs = question.matching_pairs ?? [];
    const map = (response as Record<string, string>) ?? {};
    return (
      <div className="flex flex-col gap-2">
        {pairs.map((p) => (
          <div key={p.left} className="flex gap-2.5 items-center">
            <div className="flex-1 text-sm">{p.left}</div>
            <span className="text-textDim">→</span>
            <select
              className="input flex-1"
              disabled={disabled}
              value={map[p.left] || ""}
              onChange={(e) => setResponse({ ...map, [p.left]: e.target.value })}
            >
              <option value="">Select match…</option>
              {(p.options ?? pairs.map((x) => x.right)).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  // scenario / code_output / code_completion fall back to single-answer rendering when options exist
  if (opts.length) {
    return (
      <QuestionRenderer
        question={{ ...question, question_type: "single_choice" }}
        response={response}
        setResponse={setResponse}
        disabled={disabled}
      />
    );
  }

  return <div className="text-textDim text-sm">Unsupported question format.</div>;
}
