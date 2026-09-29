export type BotPlanEntry = {
  willBeCorrect: boolean;
  answer: string;
  respondAfterMs: number;
};

export type BotPlanInput = {
  questionCount: number;
  secondsPerQuestion: number;
  accuracy: number;
  botRating: number;
  difficulty: number;
  random?: () => number;
};

export const BOT_ACCURACY = Number(process.env.BOT_ACCURACY ?? "0.7");

export function pickBotDisplayName(): string {
  const names = [
    "quiet_fox_42",
    "mathnerd88",
    "triangle_joe",
    "logic_lark",
    "nova_sum",
    "rational_bear",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

export function createBotPlan({
  questionCount,
  secondsPerQuestion,
  accuracy,
  botRating,
  difficulty,
  random = Math.random,
}: BotPlanInput): BotPlanEntry[] {
  const rows: BotPlanEntry[] = [];
  const minimumResponse = 1500;
  const maximumResponse = Math.max(minimumResponse, secondsPerQuestion * 1000);

  for (let index = 0; index < questionCount; index += 1) {
    const willBeCorrect = random() < accuracy;
    const timeBias = 1 + Math.max(0, (difficulty - botRating) / 2000);
    const responseBase =
      secondsPerQuestion * 1000 * (0.35 + random() * 0.25) * timeBias;
    const respondAfterMs = Math.min(
      maximumResponse,
      Math.max(minimumResponse, Math.round(responseBase)),
    );

    rows.push({
      willBeCorrect,
      answer: willBeCorrect ? "correct" : "wrong",
      respondAfterMs,
    });
  }

  return rows;
}
