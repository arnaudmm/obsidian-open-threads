// People are notes with type: person. Pure.

export interface Person {
  name: string;
  path: string;
  active: boolean;
}

export const NO_PEOPLE = "No people yet. Add type: person to a person's note.";

export function toPerson(path: string, basename: string, fm: unknown): Person | null {
  if (typeof fm !== "object" || fm === null) return null;
  const f = fm as Record<string, unknown>;
  if (f.type !== "person") return null;
  const inactive = f.active === false || (typeof f.active === "string" && f.active.trim().toLowerCase() === "false");
  return { name: basename, path, active: !inactive };
}

export function activePeople(people: Iterable<Person>): Person[] {
  return [...people].filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
