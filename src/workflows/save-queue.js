/** A failed save remains a failed flush until a later save actually succeeds. */
export function createSaveQueue(save, onError = () => {}) {
  let queue = Promise.resolve(),
    failure = null;
  return {
    enqueue(source) {
      queue = queue.then(async () => {
        try {
          await save(source);
          failure = null;
        } catch (error) {
          failure = error;
          onError(error);
        }
      });
      return queue;
    },
    async flush() {
      await queue;
      if (failure) throw failure;
    },
    get failure() {
      return failure;
    },
  };
}
export function createKeyedQueue() {
  const tails = new Map();
  return async function serialize(key, action) {
    const previous = tails.get(key) || Promise.resolve(),
      next = previous.catch(() => {}).then(action);
    tails.set(key, next);
    try {
      return await next;
    } finally {
      if (tails.get(key) === next) tails.delete(key);
    }
  };
}
