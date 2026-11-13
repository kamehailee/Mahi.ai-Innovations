import { randomBytes, timingSafeEqual } from "node:crypto";

type Role = "reader" | "editor";

const SESSION_SECONDS = 3600;
const SESSION_LIMIT = 256;
const WINDOW_MS = 60_000;
// App Router handlers can be bundled separately in the same Node process.
const runtime = globalThis as typeof globalThis & {
  haloaAuth?: {
    sessions: Map<string, { role: Role; expires: number }>;
    budgets: Map<string, { remaining: number; reset: number }>;
  };
};
const { sessions, budgets } = runtime.haloaAuth ??= { sessions: new Map(), budgets: new Map() };
const keyPattern = /^[a-f0-9]{64}$/;

export function authConfig() {
  const { HALOA_ORIGIN, HALOA_READER_KEY, HALOA_EDITOR_KEY } = process.env;
  if (!HALOA_ORIGIN || !HALOA_READER_KEY || !HALOA_EDITOR_KEY ||
    !keyPattern.test(HALOA_READER_KEY) || !keyPattern.test(HALOA_EDITOR_KEY) ||
    HALOA_READER_KEY === HALOA_EDITOR_KEY) return null;

  try {
    const url = new URL(HALOA_ORIGIN);
    const secure = url.protocol === "https:";
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.origin !== HALOA_ORIGIN || (!secure && !(loopback && url.protocol === "http:"))) {
      return null;
    }
    return { origin: url.origin, secure, reader: HALOA_READER_KEY, editor: HALOA_EDITOR_KEY };
  } catch {
    return null;
  }
}

type Config = NonNullable<ReturnType<typeof authConfig>>;

export function privateJson(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { ...extra, "Cache-Control": "private, no-store" } });
}

export function authError(error: string, status: number) {
  return privateJson({ error }, status);
}

export function checkOrigin(request: Request, config: Config) {
  if (request.headers.get("origin") !== config.origin) {
    return authError("Submit this request from the Hāloa site.", 403);
  }
}

export function checkRate(key: "login" | "reader-read" | "editor-read" | "editor-write", limit: number) {
  const now = Date.now();
  let budget = budgets.get(key);
  if (!budget || now >= budget.reset) {
    budget = { remaining: limit, reset: now + WINDOW_MS };
    budgets.set(key, budget);
  }
  if (budget.remaining === 0) {
    return privateJson({ error: "Too many requests. Try again shortly." }, 429, {
      "Retry-After": String(Math.ceil((budget.reset - now) / 1000)),
    });
  }
  budget.remaining--;
}

function cookieName(config: Config) {
  return config.secure ? "__Host-haloa-session" : "haloa-local-session";
}

export function sessionCookie(config: Config, value = "", seconds = 0) {
  return `${cookieName(config)}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; SameSite=Strict${config.secure ? "; Secure" : ""}`;
}

function sessionId(request: Request, config: Config) {
  const name = cookieName(config) + "=";
  const values = request.headers.get("cookie")?.split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(name));
  const id = values?.length === 1 ? values[0].slice(name.length) : "";
  return keyPattern.test(id) ? id : "";
}

export function revokeSession(request: Request, config: Config) {
  sessions.delete(sessionId(request, config));
}

export function signIn(request: Request, config: Config, key: string) {
  if (!keyPattern.test(key)) return authError("Invalid demo access key.", 401);
  const candidate = Buffer.from(key, "hex");
  const editor = timingSafeEqual(candidate, Buffer.from(config.editor, "hex"));
  const reader = timingSafeEqual(candidate, Buffer.from(config.reader, "hex"));
  if (!editor && !reader) return authError("Invalid demo access key.", 401);
  const role = editor ? "editor" : "reader";

  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expires <= now) sessions.delete(id);
  }
  revokeSession(request, config);
  if (sessions.size >= SESSION_LIMIT) return authError("Demo session capacity reached. Try again later.", 503);
  const id = randomBytes(32).toString("hex");
  sessions.set(id, { role, expires: now + SESSION_SECONDS * 1000 });
  return privateJson({ role }, 200, { "Set-Cookie": sessionCookie(config, id, SESSION_SECONDS) });
}

export function authorize(request: Request, write = false) {
  const config = authConfig();
  if (!config) return authError("Demo sign-in is unavailable.", 503);
  if (write) {
    const error = checkOrigin(request, config);
    if (error) return error;
  }

  const id = sessionId(request, config);
  const session = sessions.get(id);
  if (!session || session.expires <= Date.now()) {
    sessions.delete(id);
    return authError("Sign in to access demo observations.", 401);
  }
  if (write && session.role !== "editor") return authError("An editor session is required to save observations.", 403);
  const budget = write ? "editor-write" : session.role === "editor" ? "editor-read" : "reader-read";
  return checkRate(budget, write ? 30 : 120) ?? session.role;
}
