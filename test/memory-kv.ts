// Map-backed stand-in for the parts of KVNamespace the Worker uses.
export class MemoryKV {
  readonly entries = new Map<string, { value: string; metadata: unknown }>();

  async get(key: string): Promise<string | null> {
    return this.entries.get(key)?.value ?? null;
  }

  async getWithMetadata(key: string) {
    const entry = this.entries.get(key);
    return { value: entry?.value ?? null, metadata: entry?.metadata ?? null, cacheStatus: null };
  }

  async put(key: string, value: string, options?: { metadata?: unknown }): Promise<void> {
    this.entries.set(key, { value, metadata: options?.metadata ?? null });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async list(options?: { limit?: number; cursor?: string }) {
    const names = [...this.entries.keys()].sort();
    const start = options?.cursor ? Number(options.cursor) : 0;
    const end = start + (options?.limit ?? 1000);
    const keys = names.slice(start, end).map((name) => ({ name, metadata: this.entries.get(name)!.metadata ?? undefined }));
    const complete = end >= names.length;
    return complete ? { keys, list_complete: true, cacheStatus: null } : { keys, list_complete: false, cursor: String(end), cacheStatus: null };
  }
}
