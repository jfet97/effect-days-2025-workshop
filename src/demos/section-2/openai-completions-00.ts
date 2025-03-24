import { Chunk, Config, Effect, Layer, Option, Redacted, Schema, Stream } from "effect"
import * as Api from "openai"
import type { AbstractPage, PagePromise } from "openai/core.mjs"
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import type { ChatCompletionChunk } from "openai/resources/index.mjs"
import type * as ApiStreaming from "openai/streaming.mjs"

export class OpenAi extends Effect.Service<OpenAi>()("OpenAi", {
  effect: Effect.gen(function*() {
    const client = new Api.OpenAI({
      apiKey: Redacted.value(yield* Config.redacted("OPENAI_API_KEY"))
    })

    const use = Effect.fn("OpenAi.use")(<A>(
      f: (client: Api.OpenAI, signal: AbortSignal) => Promise<A>
    ): Effect.Effect<A, OpenAiError> =>
      Effect.tryPromise({
        try: (signal) => f(client, signal),
        catch: (cause) => new OpenAiError({ cause })
      })
    )

    const paginate = <Page extends AbstractPage<any>, A>(
      f: (client: Api.OpenAI) => PagePromise<Page, A>
    ): Stream.Stream<A, OpenAiError> =>
      Stream.paginateChunkEffect(
        undefined,
        Effect.fn("OpenAi.paginateChunk")(function*(cursor: Page | undefined) {
          const page = yield* Effect.tryPromise({
            try: () => cursor ? cursor.getNextPage() : f(client), // the first time we call f to get the first page
            catch: (cause) => new OpenAiError({ cause })
          })
          return [
            Chunk.unsafeFromArray(page.getPaginatedItems()),
            page.hasNextPage() ? Option.some(page) : Option.none() // to stop it at the end of the stream
          ]
        })
      ).pipe(
        Stream.withSpan("OpenAi.paginate")
      )

    // TODO: Implement the `stream` function
    client.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: []
    })

    // TODO: Add `completion` api for chat completions

    return {
      client,
      use,
      paginate
    } as const
  })
}) {}

export class OpenAiError extends Schema.TaggedError<OpenAiError>()("OpenAiError", {
  cause: Schema.Defect
}) {}
