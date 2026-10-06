/**
 * Un embedder de mentira, OpenAI-compatible, para los tests: así el cliente se
 * ejercita de verdad por HTTP sin depender del que corre en el VPS.
 */
export interface FakeEmbedderRequest {
  input: string[];
  model?: string;
}

export interface FakeEmbedder {
  url: string;
  requests: FakeEmbedderRequest[];
  stop(): void;
}

export interface FakeEmbedderOptions {
  /** Devuelve el vector de cada texto. Para simular basura, devolvé algo raro. */
  vectorFor?: (text: string, index: number) => number[];
  model?: string;
  /** Contesta con los `index` en desorden, para probar que el orden se respeta. */
  shuffle?: boolean;
  /** Fuerza una respuesta con ese status en vez del JSON. */
  status?: number;
  /** Tarda esto antes de contestar (para probar el timeout). */
  delayMs?: number;
}

export function startFakeEmbedder(options: FakeEmbedderOptions = {}): FakeEmbedder {
  const vectorFor = options.vectorFor ?? ((text: string) => [text.length, 1, 0]);
  const requests: FakeEmbedderRequest[] = [];

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as { input?: unknown; model?: string };
      const input = Array.isArray(body.input) ? body.input.map((text) => String(text)) : [];
      requests.push({ input, model: body.model });

      if (options.delayMs) await Bun.sleep(options.delayMs);
      if (options.status && options.status !== 200) {
        return new Response("nope", { status: options.status });
      }

      const data = input.map((text, index) => ({
        object: "embedding",
        index,
        embedding: vectorFor(text, index),
      }));

      return Response.json({
        object: "list",
        model: options.model ?? body.model ?? "fake",
        data: options.shuffle ? [...data].reverse() : data,
      });
    },
  });

  return {
    url: `http://127.0.0.1:${server.port}/v1/embeddings`,
    requests,
    stop: () => server.stop(true),
  };
}
