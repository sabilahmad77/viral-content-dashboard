// Redis stub for local dev without Redis server
const store = new Map<string, { value: string; expires?: number }>();

export const redis = {
  get: async (key: string): Promise<string | null> => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expires && Date.now() > entry.expires) { store.delete(key); return null; }
    return entry.value;
  },
  set: async (key: string, value: string): Promise<void> => { store.set(key, { value }); },
  setex: async (key: string, ttl: number, value: string): Promise<void> => {
    store.set(key, { value, expires: Date.now() + ttl * 1000 });
  },
  del: async (key: string): Promise<void> => { store.delete(key); },
  on: (_event: string, _cb: unknown) => {},
};

export default redis;
