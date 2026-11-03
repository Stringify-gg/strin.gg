// Map-backed stand-in for the parts of KVNamespace the server (via unstorage) uses.
export class MemoryKV {
  readonly entries = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
    const names = [...this.entries.keys()].filter((name) => name.startsWith(options?.prefix ?? "")).sort();
    const start = options?.cursor ? Number(options.cursor) : 0;
    const end = start + (options?.limit ?? 1000);
    const keys = names.slice(start, end).map((name) => ({ name }));
    return end >= names.length
      ? { keys, list_complete: true as const }
      : { keys, list_complete: false as const, cursor: String(end) };
  }
}
