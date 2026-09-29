export type RatingState = {
  rating: number;
  rd: number;
  vol: number;
};

export type MatchResult = {
  rating: number;
  rd: number;
  score: number;
};

export function computeNewRating(
  player: RatingState,
  matches: MatchResult[],
): RatingState {
  const { Glicko2 } = require("glicko2");
  const ranking = new Glicko2({ tau: 0.5, rating: 1500, rd: 200, vol: 0.06 });

  const current = ranking.makePlayer(player.rating, player.rd, player.vol);
  const matchRows: Array<[typeof current, typeof current, number]> = [];

  for (const match of matches) {
    const opponent = ranking.makePlayer(match.rating, match.rd, 0.06);
    matchRows.push([current, opponent, match.score]);
  }

  ranking.updateRatings(matchRows);

  return {
    rating: current.getRating(),
    rd: current.getRd(),
    vol: current.getVol(),
  };
}
