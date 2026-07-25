// petrovich склоняет русские ФИО по падежам, но не публикует типы —
// untyped require изолирован в этом единственном месте.
type PetrovichCase =
  | "nominative"
  | "genitive"
  | "dative"
  | "accusative"
  | "instrumental"
  | "prepositional";

type PetrovichPerson = {
  last?: string;
  first?: string;
  middle?: string;
  gender?: "male" | "female" | "androgynous";
};

type Petrovich = (person: PetrovichPerson, gcase: PetrovichCase) => PetrovichPerson;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const petrovich = require("petrovich") as Petrovich;

// В проекте ФИО вводится строкой "Фамилия Имя Отчество" — склоняем только
// такие (ровно 3 слова), а иностранные/нестандартные ФИО оставляем как
// есть, чтобы не искажать текст непредсказуемо.
export function toGenitive(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 3) return fullName;

  const [last, first, middle] = parts;
  try {
    const declined = petrovich({ last, first, middle }, "genitive");
    return [declined.last, declined.first, declined.middle]
      .filter(Boolean)
      .join(" ");
  } catch {
    return fullName;
  }
}

// "Родионов Игорь Юрьевич" -> "Родионов И.Ю." — для подписей, где полное
// имя-отчество не нужны. Те же ограничения по формату, что и у toGenitive.
export function toInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 3) return fullName;

  const [last, first, middle] = parts;
  return `${last} ${first[0]}.${middle[0]}.`;
}
