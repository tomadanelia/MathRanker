import { z } from "zod";
import { createSupabaseServerClient } from "../../../src/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "../../../src/lib/supabase/service-role";

const categorySlugSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9_-]+$/);

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  if (!category || !categorySlugSchema.safeParse(category).success) {
    return errorResponse("invalid_category", "Choose a valid category.", 400);
  }

  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return errorResponse("unauthorized", "Sign in to view your ratings.", 401);
  }

  const { data: ratings, error } = await createSupabaseServiceRoleClient()
    .from("ratings")
    .select(
      "user_id, category, preset, rating, rd, vol, games_played, updated_at",
    )
    .eq("user_id", user.id)
    .eq("category", category);

  if (error) {
    return errorResponse(
      "ratings_unavailable",
      "Your ratings could not be loaded.",
      503,
    );
  }

  return Response.json({ ratings: ratings ?? [] });
}
