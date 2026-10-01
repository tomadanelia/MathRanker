import { matchmakingJoinSchema } from "../../../src/lib/api/schemas";
import {
  BOT_ACCURACY,
  createBotPlan,
  pickBotDisplayName,
} from "../../../src/lib/game/bot";
import {
  timeControls,
  type TimeControl,
} from "../../../src/lib/game/time-controls";
import { createSupabaseServerClient } from "../../../src/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "../../../src/lib/supabase/service-role";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return errorResponse("unauthorized", "Sign in to check matchmaking.", 401);
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const { data: queueEntry, error } = await serviceClient
    .from("matchmaking_queue")
    .select(
      "matched_game_id, category, preset, joined_at, bot_after_ms, rating",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return errorResponse(
      "matchmaking_unavailable",
      "Matchmaking is temporarily unavailable.",
      503,
    );
  }

  if (!queueEntry) {
    return Response.json({ status: "not_queued" });
  }

  if (queueEntry.matched_game_id) {
    return Response.json({
      status: "matched",
      gameId: queueEntry.matched_game_id,
    });
  }

  const waitTimeMs = Date.now() - new Date(queueEntry.joined_at).getTime();
  if (waitTimeMs >= queueEntry.bot_after_ms) {
    const rules = timeControls[queueEntry.preset as TimeControl];
    if (!rules) {
      return errorResponse(
        "matchmaking_unavailable",
        "This match preset is not supported.",
        503,
      );
    }

    const ratingOffset = Number(process.env.BOT_RATING_OFFSET ?? "0");
    const botRating = Math.max(
      800,
      Math.round(
        queueEntry.rating + (Number.isFinite(ratingOffset) ? ratingOffset : 0),
      ),
    );
    const botAccuracy = Number.isFinite(BOT_ACCURACY)
      ? Math.min(1, Math.max(0, BOT_ACCURACY))
      : 0.7;
    const plan = createBotPlan({
      questionCount: rules.questionCount,
      secondsPerQuestion: rules.secondsPerQuestion,
      accuracy: botAccuracy,
      botRating,
      difficulty: queueEntry.rating,
    });
    const { data: gameId, error: botError } = await serviceClient.rpc(
      "create_bot_game_for_waiting_player",
      {
        p_user_id: user.id,
        p_bot_display_name: pickBotDisplayName(),
        p_bot_rating: botRating,
        p_plan: plan,
      },
    );

    if (botError) {
      if (botError.message.includes("insufficient_active_questions")) {
        return errorResponse(
          "not_enough_questions",
          "There are not enough active questions for this category yet.",
          409,
        );
      }
      return errorResponse(
        "matchmaking_unavailable",
        "Matchmaking is temporarily unavailable.",
        503,
      );
    }

    if (gameId) {
      return Response.json({ status: "matched", gameId });
    }
  }

  return Response.json({ status: "waiting" });
}

export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return errorResponse("unauthorized", "Sign in to find a match.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = matchmakingJoinSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      "invalid_request",
      "Choose a valid category and preset.",
      400,
    );
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const { data: rating, error: ratingError } = await serviceClient
    .from("ratings")
    .select("rating")
    .eq("user_id", user.id)
    .eq("category", parsed.data.category)
    .eq("preset", parsed.data.preset)
    .maybeSingle();

  if (ratingError) {
    return errorResponse(
      "matchmaking_unavailable",
      "Matchmaking is temporarily unavailable.",
      503,
    );
  }

  if (!rating) {
    return errorResponse(
      "category_not_found",
      "That category is not available.",
      404,
    );
  }

  const { data: gameId, error: matchmakingError } = await serviceClient.rpc(
    "join_matchmaking_queue",
    {
      p_user_id: user.id,
      p_category: parsed.data.category,
      p_preset: parsed.data.preset,
      p_rating: rating.rating,
    },
  );

  if (matchmakingError) {
    if (matchmakingError.code === "P0002") {
      return errorResponse(
        "category_not_found",
        "That category is not available.",
        404,
      );
    }

    if (matchmakingError.message.includes("insufficient_active_questions")) {
      return errorResponse(
        "not_enough_questions",
        "There are not enough active questions for this category yet.",
        409,
      );
    }

    return errorResponse(
      "matchmaking_unavailable",
      "Matchmaking is temporarily unavailable.",
      503,
    );
  }

  return Response.json(
    gameId ? { status: "matched", gameId } : { status: "waiting" },
  );
}

export async function DELETE() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return errorResponse("unauthorized", "Sign in to update matchmaking.", 401);
  }

  const { data, error } = await createSupabaseServiceRoleClient()
    .from("matchmaking_queue")
    .delete()
    .eq("user_id", user.id)
    .is("matched_game_id", null)
    .select("user_id");

  if (error) {
    return errorResponse(
      "matchmaking_unavailable",
      "Matchmaking is temporarily unavailable.",
      503,
    );
  }

  return Response.json({
    status: data.length > 0 ? "cancelled" : "not_waiting",
  });
}
