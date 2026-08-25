import {
  createReactionPostHandler,
  createSupabaseReactionDependencies,
} from "@/server/reactions/reaction-api";
import {
  createSupabaseAbuseGuardDependencies,
  hashVercelNetwork,
} from "@/server/abuse/abuse-guard-api";

const dependencies = createSupabaseReactionDependencies(process.env);
const abuseGuard = createSupabaseAbuseGuardDependencies(process.env);

export const POST = createReactionPostHandler({
  ...dependencies,
  async assessAbuse({ userId, restaurantId, action, request }) {
    return abuseGuard.enforce({
      userId,
      restaurantId,
      action,
      networkHash: hashVercelNetwork(request, process.env),
    });
  },
});
