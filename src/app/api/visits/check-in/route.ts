import { createSupabaseReactionDependencies } from "@/server/reactions/reaction-api";
import {
  createSupabaseVisitProofDependencies,
  createVisitCheckInPostHandler,
} from "@/server/visits/visit-proof-api";

const reactionDependencies = createSupabaseReactionDependencies(process.env);
const visitProofDependencies = createSupabaseVisitProofDependencies(process.env);

export const POST = createVisitCheckInPostHandler({
  verifyAccessToken: reactionDependencies.verifyAccessToken,
  issueLocationProof: visitProofDependencies.issueLocationProof,
});
