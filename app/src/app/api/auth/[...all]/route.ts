import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/modules/auth/auth";

// Better Auth endpoints (email verification links, password reset callbacks, sign-out, …).
export const { GET, POST } = toNextJsHandler(auth);
