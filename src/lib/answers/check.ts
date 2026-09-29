export type AnswerCheckType = "multiple_choice" | "numeric";

export type CheckAnswerInput = {
  answer?: string;
  acceptedAnswers?: string[];
  tolerance?: number;
  choices?: Array<{ id: string; text?: string }>;
};

const normalizeWhitespace = (value: string) =>
  value.trim().replace(/\s+/g, " ");

const coerceNumber = (value: string): number | null => {
  if (!value || value.length > 50) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed
    .replace(/,/g, ".")
    .replace(/−/g, "-")
    .replace(/−/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/\s+/g, "");

  if (
    !/^[-+]?((\d+(\.\d*)?)|(\.\d+))(?:[eE][-+]?\d+)?$|^[-+]?\d+\/\d+$/.test(
      normalized,
    )
  ) {
    return null;
  }

  try {
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export function normalizeNumericAnswer(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const raw = normalizeWhitespace(value);
  const cleaned = raw
    .replace(/,/g, ".")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/^\+/, "");

  if (!cleaned || cleaned.length > 50) return null;

  if (cleaned.includes("/")) {
    const slashSplit = cleaned.split("/");
    if (slashSplit.length !== 2) return null;
    const numerator = coerceNumber(slashSplit[0]);
    const denominator = coerceNumber(slashSplit[1]);
    if (numerator === null || denominator === null || denominator === 0)
      return null;
    const fractionValue = numerator / denominator;
    if (!Number.isFinite(fractionValue)) return null;
    return Number.isInteger(fractionValue)
      ? String(fractionValue)
      : fractionValue
          .toFixed(12)
          .replace(/\.0+$|0+$/, "")
          .replace(/\.$/, "");
  }

  const numericValue = coerceNumber(cleaned);
  if (numericValue === null) return null;
  if (!Number.isFinite(numericValue)) return null;

  const fixed = Number(numericValue.toFixed(12));
  return String(fixed);
}

export function checkAnswer(
  type: AnswerCheckType,
  expected: string,
  input: CheckAnswerInput = {},
): boolean {
  if (type === "multiple_choice") {
    const answer = normalizeWhitespace(expected ?? "");
    return (
      answer === (input.answer ?? "") ||
      input.choices?.some(
        (choice) => choice.id === input.answer && choice.id === answer,
      ) ||
      false
    );
  }

  const normalizedExpected = normalizeNumericAnswer(expected);
  if (normalizedExpected === null) return false;

  const candidate = normalizeNumericAnswer(input.answer ?? "");
  if (candidate === null) return false;

  const tolerance = Number(input.tolerance ?? 0);
  if (Number.isNaN(tolerance) || tolerance < 0) return false;

  const accepted = new Set(
    (input.acceptedAnswers ?? [])
      .map((value) => normalizeNumericAnswer(value))
      .filter((value): value is string => value !== null),
  );
  if (accepted.has(candidate)) return true;

  const difference = Math.abs(Number(normalizedExpected) - Number(candidate));
  return difference <= tolerance;
}
