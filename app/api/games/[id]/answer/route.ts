import { z } from "zod";
import { answerRequestSchema } from "../../../../../src/lib/api/schemas";
import {
  checkAnswer,
  type AnswerCheckType,
} from "../../../../../src/lib/answers/check";
import { finalizeGameRating } from "../../../../../src/lib/game/finalize-result";
import { createSupabaseServerClient } from "../../../../../src/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "../../../../../src/lib/supabase/service-role";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => null);
  const parsed = answerRequestSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("invalid_request", "Submit a valid answer.", 400);
  }

  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return errorResponse("unauthorized", "Sign in to submit an answer.", 401);
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const { data: game, error: gameError } = await serviceClient
    .from("games")
    .select(
      "id, status, player_a, player_b, current_position, question_count, winner",
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

  if (!game) {
    return errorResponse(
      "game_not_found",
      "That game could not be found.",
      404,
    );
  }

  if (game.player_a !== user.id && game.player_b !== user.id) {
    return errorResponse(
      "forbidden",
      "You are not a player in this game.",
      403,
    );
  }

  if (
    game.status === "active" &&
    game.current_position >= game.question_count &&
    game.winner
  ) {
    try {
      await finalizeGameRating(game.id);
      return Response.json({
        result: { accepted: false, gameFinished: true, winner: game.winner },
      });
    } catch {
      return errorResponse(
        "rating_unavailable",
        "The final result is saved and its rating update is being retried.",
        503,
      );
    }
  }

  if (game.status !== "active") {
    return errorResponse(
      "game_not_active",
      "This game is no longer active.",
      409,
    );
  }

  if (game.current_position !== parsed.data.position) {
    return errorResponse(
      "stale_position",
      "The game has moved to another question.",
      409,
    );
  }

  const { data: assignment, error: assignmentError } = await serviceClient
    .from("game_questions")
    .select("question_id")
    .eq("game_id", game.id)
    .eq("position", parsed.data.position)
    .maybeSingle();

  if (assignmentError || !assignment) {
    return errorResponse(
      "question_unavailable",
      "The current question could not be loaded.",
      503,
    );
  }

  const { data: question, error: questionError } = await serviceClient
    .from("questions")
    .select("id, type, correct_answer, accepted_answers, tolerance, choices")
    .eq("id", assignment.question_id)
    .maybeSingle();

  if (questionError || !question) {
    return errorResponse(
      "question_unavailable",
      "The current question could not be loaded.",
      503,
    );
  }

  const choices = Array.isArray(question.choices)
    ? (question.choices as Array<{ id: string; text?: string }>)
    : undefined;
  const isCorrect = checkAnswer(
    question.type as AnswerCheckType,
    question.correct_answer,
    {
      answer: parsed.data.answer,
      acceptedAnswers: question.accepted_answers,
      tolerance: question.tolerance,
      choices,
    },
  );

  const { data: result, error: submitError } = await serviceClient.rpc(
    "submit_game_answer",
    {
      p_game_id: game.id,
      p_user_id: user.id,
      p_position: parsed.data.position,
      p_question_id: question.id,
      p_answer: parsed.data.answer,
      p_is_correct: isCorrect,
    },
  );

  if (submitError) {
    if (submitError.code === "P0002") {
      return errorResponse(
        "game_not_found",
        "That game could not be found.",
        404,
      );
    }

    if (submitError.code === "42501") {
      return errorResponse(
        "forbidden",
        "You are not a player in this game.",
        403,
      );
    }

    if (submitError.message.includes("stale_game_position")) {
      return errorResponse(
        "stale_position",
        "The game has moved to another question.",
        409,
      );
    }

    if (submitError.message.includes("game_not_active")) {
      return errorResponse(
        "game_not_active",
        "This game is no longer active.",
        409,
      );
    }

    return errorResponse(
      "answer_unavailable",
      "The answer could not be submitted.",
      503,
    );
  }

  if (result?.accepted === false) {
    return errorResponse(
      "already_answered",
      "You already answered this question.",
      409,
    );
  }

  if (result?.gameFinished) {
    try {
      await finalizeGameRating(game.id);
    } catch {
      return errorResponse(
        "rating_unavailable",
        "The final result is saved and its rating update is being retried.",
        503,
      );
    }
  }

  return Response.json({ result });
}
