/** Serialises writes and coalesces queued edits. An older save can never finish last. */
export function createLatestSave<T>(save: (value: T) => Promise<void>) {
  let pending: { value: T } | null = null;
  let running: Promise<void> | null = null;
  return (value: T): Promise<void> => {
    pending = { value };
    if (!running) {
      running = Promise.resolve().then(async () => {
        try {
          while (pending) {
            const next = pending;
            pending = null;
            await save(next.value);
          }
        } finally {
          running = null;
        }
      });
    }
    return running;
  };
}
