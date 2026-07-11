export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      const delay = baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s...
      console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}