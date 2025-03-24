import { NodeRuntime } from "@effect/platform-node"
import { Config, Data, Effect, Layer, Redacted } from "effect"
import * as Api from "openai"
import { TracingLayer } from "../../Tracing.js"

class OpenAIError extends Data.TaggedError("OpenAIError")<{
  cause: unknown
}> {}

export class OpenAi extends Effect.Service<OpenAi>()("OpenAi", {
  effect: Effect.gen(function*() {
    const client = new Api.OpenAI({
      apiKey: Redacted.value(yield* Config.redacted("OPENAI_API_KEY"))
    }) // no need to kill the client, otherwise use acquireRelease

    // Effect.fn add a span => telemetry (same sa Effect.withSpan)
    const use = Effect.fn("OpenAI.use")(<A>(
      f: (client: Api.OpenAI, signal: AbortSignal) => Promise<A>
    ): Effect.Effect<A, OpenAIError> =>
      Effect.tryPromise({
        try: (signal) => f(client, signal),
        catch: (cause) => new OpenAIError({ cause })
      })
    )

    return {
      use
    } as const
  })
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
