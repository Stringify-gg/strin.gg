import { serverFetch } from "nitro";
import { MemoryKV } from "./memory-kv.ts";

/** The bindings the server sees during tests; reset before each test. */
export const testEnv: { URL_SHORTENER: MemoryKV } & Record<string, unknown> = { URL_SHORTENER: new MemoryKV() };

export function resetTestEnv(vars: Record<string, string> = {}) {
  for (const key of Object.keys(testEnv)) delete testEnv[key];
  Object.assign(testEnv, { URL_SHORTENER: new MemoryKV(), ...vars });
}

/** Sends a request through the Nitro app. Paths default to http://localhost. */
export function call(path: string, init?: RequestInit) {
  return serverFetch(path.startsWith("http") ? path : `http://localhost${path}`, init);
}

/** The parsed JSON body; untyped so tests can assert on any shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bodyOf = (res: Response): Promise<any> => res.json();

export function postJson(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) };
}
