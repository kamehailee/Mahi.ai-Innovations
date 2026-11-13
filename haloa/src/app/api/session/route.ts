import {
  authConfig, authError, checkOrigin, checkRate, privateJson, revokeSession, sessionCookie, signIn,
} from "../../../server/auth.ts";

export async function POST(request: Request) {
  const config = authConfig();
  if (!config) return authError("Demo sign-in is unavailable.", 503);
  const error = checkOrigin(request, config) ?? checkRate("login", 10);
  if (error) return error;
  // The credential is accepted in a bounded header. This endpoint reads no body.
  return signIn(request, config, request.headers.get("x-haloa-access-key") ?? "");
}

export async function DELETE(request: Request) {
  const config = authConfig();
  if (!config) return authError("Demo sign-in is unavailable.", 503);
  const error = checkOrigin(request, config);
  if (error) return error;
  revokeSession(request, config);
  return privateJson({ signedOut: true }, 200, { "Set-Cookie": sessionCookie(config) });
}
