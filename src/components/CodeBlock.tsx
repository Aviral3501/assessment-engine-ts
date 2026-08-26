
const SQL_KEYWORDS =
  /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|VIEW|WAREHOUSE|AS|AND|OR|NOT|NULL|IS|IN|LIKE|LIMIT|WITH|OVER|PARTITION BY|CASE|WHEN|THEN|ELSE|END|DISTINCT|COPY|STAGE|PIPE|STREAM|TASK|GRANT|ROLE)\b/gi;
const PY_KEYWORDS = /\b(def|class|import|from|return|if|elif|else|for|while|try|except|with|as|lambda|None|True|False|self)\b/g;

function highlight(code: string, language?: string): string {
  let escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lang = (language || "sql").toLowerCase();

  if (lang.includes("json")) {
    escaped = escaped.replace(/("(\\.|[^"\\])*")(\s*:)?/g, (m) => `<span style="color:#E0A63E">${m}</span>`);
    return escaped;
  }

  const keywordRe = lang.includes("py") ? PY_KEYWORDS : SQL_KEYWORDS;
  escaped = escaped.replace(keywordRe, (m) => `<span style="color:#4FA3E3;font-weight:600">${m}</span>`);
  escaped = escaped.replace(/(--.*$|#.*$)/gm, (m) => `<span style="color:#5C6C77">${m}</span>`);
  escaped = escaped.replace(/'([^']*)'/g, (m) => `<span style="color:#4FB07C">${m}</span>`);
  return escaped;
}

export function CodeBlock({ code, language }: { code?: string | null; language?: string }) {
  if (!code) return null;
  return (
    <div className="card my-2.5 overflow-x-auto" style={{ background: "#0C1114", padding: "12px 14px" }}>
      <pre
        className="m-0 text-[13px] leading-relaxed text-text"
        style={{ fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)" }}
        dangerouslySetInnerHTML={{ __html: highlight(code, language) }}
      />
    </div>
  );
}
