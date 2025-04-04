import { NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer, Redacted, Schema } from "effect"
import * as Api from "openai"
import { TracingLayer } from "../../Tracing.js"

export class OpenAi extends Effect.Service<OpenAi>()("OpenAi", {
  effect: Effect.gen(function*() {
    const client = new Api.OpenAI({
      apiKey: Redacted.value(yield* Config.redacted("OPENAI_API_KEY"))
    })

    const use = Effect.fn("OpenAI.use")(<A>(
      f: (client: Api.OpenAI, signal: AbortSignal) => Promise<A>
    ): Effect.Effect<A, OpenAiError> =>
      Effect.tryPromise({
        try: (signal) => f(client, signal),
        catch: (cause) => new OpenAiError({ cause })
      })
    )

    return {
      client,
      use
    } as const
  })
}) {}

export class OpenAiError extends Schema.TaggedError<OpenAiError>()("OpenAiError", {
  cause: Schema.Defect
}) {}

// usage

Effect.gen(function*() {
  const openai = yield* OpenAi

  const result = yield* openai.use((client, signal) =>
    client.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: "What is the meaning of life?"
      }]
    }, { signal })
  )

  yield* Effect.log(result.choices)
}).pipe(
  Effect.provide(OpenAi.Default.pipe(
    Layer.provideMerge(TracingLayer)
  )),
  NodeRuntime.runMain
)
