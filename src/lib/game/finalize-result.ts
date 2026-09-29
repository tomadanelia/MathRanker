import "server-only";
import { computeNewRating } from "../ratings/glicko";
import { createSupabaseServiceRoleClient } from "../supabase/service-role";

type StoredRating = {
  user_id: string;
  rating: number;
  rd: number;
  vol: number;
};

export async function finalizeGameRating(gameId: string): Promise<boolean> {
  const client = createSupabaseServiceRoleClient();
  const { data: game, error: gameError } = await client
    .from("games")
    .select(
      "category, status, player_a, player_b, is_bot, bot_display_rating, current_position, question_count, winner, score_a, score_b",
    )
    .eq("id", gameId)
    .maybeSingle();

  if (gameError) throw new Error("Could not load the final game result.");
  if (!game) throw new Error("Game not found.");
  if (game.status === "finished") return true;
  if (
    game.status !== "active" ||
    game.current_position < game.question_count ||
    !game.winner ||
    game.score_a === null ||
    game.score_b === null
  ) {
    return false;
  }

  const userIds = game.player_b
    ? [game.player_a, game.player_b]
    : [game.player_a];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: ratings, error: ratingsError } = await client
      .from("ratings")
      .select("user_id, rating, rd, vol")
      .eq("category", game.category)
      .in("user_id", userIds);

    if (ratingsError) throw new Error("Could not load player ratings.");
    const ratingByUser = new Map(
      (ratings as StoredRating[]).map((rating) => [rating.user_id, rating]),
    );
    const ratingA = ratingByUser.get(game.player_a);
    const ratingB = game.player_b ? ratingByUser.get(game.player_b) : null;
    const opponentRating =
      ratingB ??
      (game.is_bot
        ? {
            rating: game.bot_display_rating ?? 1500,
            rd: 100,
            vol: 0.06,
          }
        : null);

    if (!ratingA || (game.player_b && !ratingB)) {
      throw new Error("A player rating is missing.");
    }

    const scoreA = game.winner === "draw" ? 0.5 : game.winner === "a" ? 1 : 0;
    const scoreB = 1 - scoreA;
    const nextA = computeNewRating(
      ratingA,
      opponentRating
        ? [
            {
              rating: opponentRating.rating,
              rd: opponentRating.rd,
              score: scoreA,
            },
          ]
        : [],
    );
    const nextB = ratingB
      ? computeNewRating(ratingB, [
          {
            rating: ratingA.rating,
            rd: ratingA.rd,
            score: scoreB,
          },
        ])
      : null;

    const payload = {
      winner: game.winner,
      score_a: game.score_a,
      score_b: game.score_b,
      player_a: {
        rating_before: ratingA.rating,
        rating_after: nextA.rating,
        rd_after: nextA.rd,
        vol_after: nextA.vol,
      },
      ...(ratingB && nextB
        ? {
            player_b: {
              rating_before: ratingB.rating,
              rating_after: nextB.rating,
              rd_after: nextB.rd,
              vol_after: nextB.vol,
            },
          }
        : {}),
    };

    const { error: applyError } = await client.rpc("apply_game_result", {
      p_game_id: gameId,
      p_payload: payload,
    });

    if (!applyError) return true;
    if (applyError.code !== "40001" || attempt === 1) {
      throw new Error("Could not apply the final rating update.");
    }
  }

  return false;
}
