export const timeControls = {
  blitz: {
    label: "Blitz",
    description: "5 x 10 sec",
    questionCount: 5,
    secondsPerQuestion: 10,
  },
  standard: {
    label: "Standard",
    description: "10 x 20 sec",
    questionCount: 10,
    secondsPerQuestion: 20,
  },
  rapid: {
    label: "Rapid",
    description: "10 x 45 sec",
    questionCount: 10,
    secondsPerQuestion: 45,
  },
} as const;

export type TimeControl = keyof typeof timeControls;
