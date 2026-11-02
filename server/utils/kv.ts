import { useKV } from "nitro/kv";
import type { StorageValue } from "unstorage";

/** Mounts configured under `kv` in nitro.config.ts. */
export type KVMountName = "url_shortener";

/**
 * Typed `useKV` for one mount, optionally scoped to a key prefix.
 * Values are stored as JSON and trusted on read, not validated.
 *
 * Keys go through unstorage: "/" and "\" become ":", and anything after "?" is dropped.
 *
 * ```ts
 * const sessions = useTypedKV<Session>("url_shortener", "sessions");
 * await sessions.setItem(id, session, { ttl: 3600 }); // ttl in seconds, KV minimum is 60
 * const session = await sessions.getItem(id); // Session | null
 * ```
 */
export const useTypedKV = <V extends StorageValue>(mount: KVMountName, prefix?: string) =>
  useKV<V>(prefix ? `${mount}:${prefix}` : mount);
