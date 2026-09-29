Math Ranker is a short-form rated math duel app. The app uses Next.js App Router, TypeScript, pnpm, and a hosted Supabase project for Postgres and Auth. Game rules and answer checking will be server-authoritative; do not connect clients directly to protected game or question tables.

## Development setup

1. Install dependencies with `pnpm install`.
2. Create a hosted Supabase project. Local Supabase and Docker are not used.
3. Copy `.env.example` to `.env.local` and enter the project's URL, anon key, and service-role key. Keep the service-role key server-side and out of source control.
4. Start the app with `pnpm dev` and open `http://localhost:3000`.

Do not create or modify the schema manually in the Supabase dashboard; migrations are the source of truth.

## Hosted migrations

The repository contains migrations for the initial schema, matchmaking, answer submission, and a small starter question bank. To apply them to the intended hosted project:

1. Authenticate the Supabase CLI with an account that has access to the project: `pnpm dlx supabase login`.
2. Link the project using its ref from the Supabase project URL: `pnpm dlx supabase link --project-ref <project-ref>`. The CLI also requires the project's database password; enter it only in the terminal prompt.
3. Review pending changes with `pnpm dlx supabase migration list`.
4. Apply pending migrations with `pnpm dlx supabase db push`.

The API keys in `.env.local` are not a substitute for the CLI access token or database password. Do not put either credential in the repository or share it in chat.

## Validation

- `pnpm lint` runs ESLint.
- `pnpm typecheck` runs TypeScript without emitting files.
- `pnpm build` builds the Next.js app.

## Hosted Supabase notes

Use the same hosted project for local development and deployment until a separate production setup is needed. Development signups and games therefore persist in that project. In Supabase Auth settings, set the local Site URL to `http://localhost:3000`, configure production redirect URLs before deployment, and disable email confirmation during development or configure SMTP. Supabase free projects may pause after a week of inactivity and need to be resumed from the dashboard.
