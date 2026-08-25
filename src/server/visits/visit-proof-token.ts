import { createHash, randomBytes } from "node:crypto";

const visitProofTokenPattern = /^[A-Za-z0-9_-]{32,128}$/;

export function isVisitProofToken(value: unknown): value is string {
  return typeof value === "string" && visitProofTokenPattern.test(value);
}

export function createVisitProofToken() {
  return randomBytes(32).toString("base64url");
}

export function digestVisitProofToken(token: string) {
  if (!isVisitProofToken(token)) {
    throw new Error("invalid visit proof token");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}
