import {
  createReactionPostHandler,
  createSupabaseReactionDependencies,
} from "@/server/reactions/reaction-api";

const dependencies = createSupabaseReactionDependencies(process.env);

export const POST = createReactionPostHandler(dependencies);
