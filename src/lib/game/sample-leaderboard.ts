import type { TimeControl } from "./time-controls";

export const sampleLeaderboards: Record<
  TimeControl,
  Array<{ username: string; rating: number }>
> = {
  blitz: [
    { username: "numberfox", rating: 2386 },
    { username: "sum_sprinter", rating: 2261 },
    { username: "primepulse", rating: 2184 },
    { username: "quickquotient", rating: 1535 },
    { username: "digitdash", rating: 1512 },
    { username: "factorflash", rating: 1488 },
    { username: "rootrunner", rating: 1462 },
  ],
  standard: [
    { username: "proofpoint", rating: 2452 },
    { username: "algebrakit", rating: 2310 },
    { username: "squaredaway", rating: 2206 },
    { username: "axiom_ace", rating: 1535 },
    { username: "equal_sign", rating: 1512 },
    { username: "proofpilot", rating: 1488 },
    { username: "curvecraft", rating: 1462 },
  ],
  rapid: [
    { username: "quiet_theorem", rating: 2524 },
    { username: "vectorviolet", rating: 2392 },
    { username: "logic_lark", rating: 2278 },
    { username: "tangenttrail", rating: 1535 },
    { username: "arrayarc", rating: 1512 },
    { username: "theoremrush", rating: 1488 },
    { username: "vertexwave", rating: 1462 },
  ],
};

export const categoryRatingOffsets: Record<string, number> = {
  arithmetic: 0,
  algebra: 34,
  geometry: -21,
  mixed: 12,
};

