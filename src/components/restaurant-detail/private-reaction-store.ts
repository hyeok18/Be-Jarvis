import type { ReactionKind } from "@/domain/types";

export const PRIVATE_REACTION_STORAGE_KEY = "be-jarvis:private-reactions:v1";

type ReactionStorage = Pick<Storage, "getItem" | "setItem">;

const REACTION_KINDS: readonly ReactionKind[] = ["like", "okay", "dislike"];

function isReactionKind(value: unknown): value is ReactionKind {
  return REACTION_KINDS.includes(value as ReactionKind);
}

function readReactionRecord(storage: Pick<Storage, "getItem">) {
  try {
    const serialized = storage.getItem(PRIVATE_REACTION_STORAGE_KEY);
    if (!serialized) return {};

    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, ReactionKind] =>
        isReactionKind(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function readPrivateReaction(
  storage: Pick<Storage, "getItem">,
  restaurantId: string,
): ReactionKind | null {
  return readReactionRecord(storage)[restaurantId] ?? null;
}

export function savePrivateReaction(
  storage: ReactionStorage,
  restaurantId: string,
  kind: ReactionKind,
) {
  const nextRecord = {
    ...readReactionRecord(storage),
    [restaurantId]: kind,
  };

  storage.setItem(PRIVATE_REACTION_STORAGE_KEY, JSON.stringify(nextRecord));
}

