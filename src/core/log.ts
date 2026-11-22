// The "## Log" section of a thread note: one line per change made through
// the plugin, "- YYYY-MM-DD · what". Pure.

const SEP = " · ";
const LOG_HEADING = /^##\s+Log\s*$/;
const SECTION_END = /^#{1,2}\s/;
// "- DATE · closed", or an older "- DATE · status X → done|cancelled".
const CLOSED = /^- (\d{4}-\d{2}-\d{2}) · (?:closed|status .* → (?:done|cancelled))\s*$/;

export type Field = "status" | "with" | "due" | "follow-up";

function oneLine(s: string): string {
  return s.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

export function checkInLine(date: string, note: string, next: string | null): string {
  const n = oneLine(note);
  return `- ${date}${SEP}check-in${n === "" ? "" : `${SEP}${n}`}${SEP}next ${next ?? "none"}`;
}

export function changeLine(date: string, field: Field, from: string | null, to: string | null): string {
  if (field === "status") return `- ${date}${SEP}${to === "closed" ? "closed" : "reopened"}`;
  return `- ${date}${SEP}${field} ${from ?? "none"} → ${to ?? "none"}`;
}

/** The index of the "## Log" heading and the end (exclusive) of its section, or null. */
function logSection(lines: string[]): { heading: number; end: number } | null {
  const heading = lines.findIndex((l) => LOG_HEADING.test(l));
  if (heading === -1) return null;
  let end = lines.length;
  for (let i = heading + 1; i < lines.length; i++) {
    if (SECTION_END.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { heading, end };
}

/** Adds `line` after the last entry of the Log section, creating the section at the end when missing. */
export function appendLogLine(content: string, line: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(eol);
  const section = logSection(lines);
  if (section === null) {
    const head = content.replace(/\s+$/, "");
    return `${head === "" ? "" : `${head}${eol}${eol}`}## Log${eol}${line}${eol}`;
  }
  let at = section.heading + 1;
  for (let i = section.end - 1; i > section.heading; i--) {
    if (lines[i].trim() !== "") {
      at = i + 1;
      break;
    }
  }
  lines.splice(at, 0, line);
  if (at === lines.length - 1) lines.push("");
  return lines.join(eol);
}

/** The date of the last closing line, or null. */
export function lastClosedOn(content: string): string | null {
  let last: string | null = null;
  for (const l of content.split(/\r?\n/)) {
    const m = CLOSED.exec(l);
    if (m !== null) last = m[1];
  }
  return last;
}
