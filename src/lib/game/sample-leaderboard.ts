import type { TimeControl } from "./time-controls";

export const sampleLeaderboards: Record<
  TimeControl,
  Array<{ username: string; rating: number }>
> = {
  blitz: [
    { username: "numberfox", rating: 2386 },
    { username: "sum_sprinter", rating: 2261 },
    { username: "primepulse", rating: 2184 },
  ],
  standard: [
    { username: "proofpoint", rating: 2452 },
    { username: "algebrakit", rating: 2310 },
    { username: "squaredaway", rating: 2206 },
  ],
  rapid: [
    { username: "quiet_theorem", rating: 2524 },
    { username: "vectorviolet", rating: 2392 },
    { username: "logic_lark", rating: 2278 },
  ],
};

export const categoryRatingOffsets: Record<string, number> = {
  arithmetic: 0,
  algebra: 34,
  geometry: -21,
  mixed: 12,
};

