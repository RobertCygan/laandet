import type { AccountStatus, Role } from "@/db/schema";

export type UserActor = {
  kind: "user";
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  locale: "nb" | "en";
  emailVerified: boolean;
  /** "strong" only after a real identity-provider verification (Phase 05). */
  idLevel: "none" | "basic" | "strong";
  staff2fa: boolean;
  staffSessionFresh: boolean;
  isNewAccount: boolean;
  sessionId: string;
};

export type Actor = { kind: "anonymous" } | UserActor;

/** Minimal actor for pure policy tests and the worker. */
export function testUser(overrides: Partial<UserActor> = {}): UserActor {
  return {
    kind: "user",
    id: "00000000-0000-0000-0000-000000000001",
    name: "Test",
    email: "test@example.test",
    role: "user",
    status: "active",
    locale: "nb",
    emailVerified: true,
    idLevel: "none",
    staff2fa: false,
    staffSessionFresh: true,
    isNewAccount: false,
    sessionId: "s",
    ...overrides,
  };
}
