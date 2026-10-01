import { z } from "zod";
import { finalizeGameRating } from "../../../../src/lib/game/finalize-result";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "../../../../src/lib/supabase/service-role";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return errorResponse(
      "invalid_game_id",
      "That game could not be found.",
      400,
    );
  }

  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return errorResponse("unauthorized", "Sign in to view this game.", 401);
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const { data: initialGame, error: gameError } = await serviceClient
    .from("games")
    .select(
      "id, category, preset, question_count, seconds_per_question, status, player_a, player_b, is_bot, bot_display_name, bot_display_rating, current_position, question_started_at, winner, score_a, score_b, rating_a_before, rating_a_after, rating_b_before, rating_b_after, created_at, finished_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (gameError) {
    return errorResponse(
      "game_unavailable",
      "The game could not be loaded.",
      503,
    );
  }

  if (!initialGame) {
    return errorResponse(
      "game_not_found",
      "That game could not be found.",
      404,
    );
  }

  let game = initialGame;

  const side =
    game.player_a === user.id ? "a" : game.player_b === user.id ? "b" : null;
  if (!side) {
    return errorResponse(
      "forbidden",
      "You are not a player in this game.",
      403,
    );
  }

  if (game.is_bot && game.status === "active") {
    const { error: botTurnError } = await serviceClient.rpc(
      "process_game_bot_turn",
      { p_game_id: game.id, p_position: game.current_position },
    );
    if (botTurnError) {
      return errorResponse(
        "game_unavailable",
        "The bot's response could not be processed.",
        503,
      );
    }

    const refreshedGame = await serviceClient
      .from("games")
      .select(
        "id, category, preset, question_count, seconds_per_question, status, player_a, player_b, is_bot, bot_display_name, bot_display_rating, current_position, question_started_at, winner, score_a, score_b, rating_a_before, rating_a_after, rating_b_before, rating_b_after, created_at, finished_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (refreshedGame.error || !refreshedGame.data) {
      return errorResponse(
        "game_unavailable",
        "The game could not be loaded.",
        503,
      );
    }
    game = refreshedGame.data;
  }

  if (
    game.status === "active" &&
    game.current_position >= game.question_count &&
    game.winner
  ) {
    try {
      await finalizeGameRating(game.id);
    } catch {
      return errorResponse(
        "rating_unavailable",
        "The final result is saved and its rating update is being retried.",
        503,
      );
    }

    const refreshed = await serviceClient
      .from("games")
      .select(
        "id, category, preset, question_count, seconds_per_question, status, player_a, player_b, is_bot, bot_display_name, bot_display_rating, current_position, question_started_at, winner, score_a, score_b, rating_a_before, rating_a_after, rating_b_before, rating_b_after, created_at, finished_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (refreshed.error || !refreshed.data) {
      return errorResponse(
        "game_unavailable",
        "The game could not be loaded.",
        503,
      );
    }
    game = refreshed.data;
  }

  const gameSummary = {
    id: game.id,
    category: game.category,
    preset: game.preset,
    status: game.status,
    side,
    isBot: game.is_bot,
    opponentName: game.is_bot ? game.bot_display_name : null,
    opponentRating: game.is_bot ? game.bot_display_rating : null,
    currentPosition: game.current_position,
    questionCount: game.question_count,
    secondsPerQuestion: game.seconds_per_question,
    questionStartedAt: game.question_started_at,
    winner: game.winner,
    scoreA: game.score_a,
    scoreB: game.score_b,
    ratingBefore: side === "a" ? game.rating_a_before : game.rating_b_before,
    ratingAfter: side === "a" ? game.rating_a_after : game.rating_b_after,
    createdAt: game.created_at,
    finishedAt: game.finished_at,
  };

  if (game.status !== "active") {
    return Response.json({ game: gameSummary });
  }

  const { data: assignment, error: assignmentError } = await serviceClient
    .from("game_questions")
    .select("question_id")
    .eq("game_id", game.id)
    .eq("position", game.current_position)
    .maybeSingle();

  if (assignmentError || !assignment) {
    return errorResponse(
      "game_unavailable",
      "The current question could not be loaded.",
      503,
    );
  }

  const { data: question, error: questionError } = await serviceClient
    .from("questions")
    .select("id, body, type, choices, image_url")
    .eq("id", assignment.question_id)
    .maybeSingle();

  if (questionError || !question) {
    return errorResponse(
      "game_unavailable",
      "The current question could not be loaded.",
      503,
    );
  }

  const { data: moves, error: movesError } = await serviceClient
    .from("game_moves")
    .select("side, position, is_correct")
    .eq("game_id", game.id)
    .lte("position", game.current_position);

  if (movesError) {
    return errorResponse(
      "game_unavailable",
      "The game state could not be loaded.",
      503,
    );
  }

  return Response.json({
    game: gameSummary,
    question: {
      id: question.id,
      body: question.body,
      type: question.type,
      choices: question.choices,
      imageUrl: question.image_url,
    },
    answerStatus: {
      a: moves.some((move) => move.side === "a" && move.position === game.current_position),
      b: moves.some((move) => move.side === "b" && move.position === game.current_position),
    },
    correctAnswers: {
      a: moves.filter((move) => move.side === "a" && move.is_correct).length,
      b: moves.filter((move) => move.side === "b" && move.is_correct).length,
    },
  });
}
