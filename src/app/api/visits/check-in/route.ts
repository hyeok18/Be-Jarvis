import { createSupabaseReactionDependencies } from "@/server/reactions/reaction-api";
import {
  createSupabaseVisitProofDependencies,
  createVisitCheckInPostHandler,
} from "@/server/visits/visit-proof-api";
import {
  createSupabaseAbuseGuardDependencies,
  hashVercelNetwork,
} from "@/server/abuse/abuse-guard-api";

const reactionDependencies = createSupabaseReactionDependencies(process.env);
const visitProofDependencies = createSupabaseVisitProofDependencies(process.env);
const abuseGuard = createSupabaseAbuseGuardDependencies(process.env);

export const POST = createVisitCheckInPostHandler({
  verifyAccessToken: reactionDependencies.verifyAccessToken,
  issueLocationProof: visitProofDependencies.issueLocationProof,
  async assessAbuse({ userId, restaurantId, action, request }) {
    return abuseGuard.enforce({
      userId,
      restaurantId,
      action,
      networkHash: hashVercelNetwork(request, process.env),
    });
  },
});
