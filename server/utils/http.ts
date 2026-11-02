import { HTTPError } from "nitro";
import { readBody, type H3Event } from "nitro/h3";

export const fail = (status: number, message: string) => new HTTPError({ status, message });

/** Reads a JSON object body, or throws 400. */
export async function readJsonObject(event: H3Event): Promise<Record<string, unknown>> {
  const body = await readBody(event).catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw fail(400, "invalid JSON body");
  return body as Record<string, unknown>;
}
