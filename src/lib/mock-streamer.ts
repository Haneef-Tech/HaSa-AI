export interface StreamOptions {
  chunkDelayMs?: number;
  onChunk: (accumulated: string) => void;
  signal?: AbortSignal;
}

export async function simulateStream(
  fullText: string,
  options: StreamOptions
): Promise<{ completed: boolean; text: string }> {
  const { chunkDelayMs = 25, onChunk, signal } = options;

  // Split text by word tokens while preserving whitespace & newlines
  const tokens = fullText.match(/\S+|\s+/g) || [fullText];
  let accumulated = "";

  for (let i = 0; i < tokens.length; i++) {
    if (signal?.aborted) {
      return { completed: false, text: accumulated };
    }

    accumulated += tokens[i];
    onChunk(accumulated);

    // Dynamic delay: longer pause on punctuation for realism
    const token = tokens[i];
    let delay = chunkDelayMs;
    if (token.endsWith(".") || token.endsWith("?") || token.endsWith("!")) {
      delay += 80;
    } else if (token.includes("\n\n")) {
      delay += 120;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return { completed: true, text: accumulated };
}

