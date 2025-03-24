import { NodeRuntime } from "@effect/platform-node"
import { Effect, FiberSet, Stream } from "effect"
import express from "express"
import { OpenAi } from "../shared/OpenAi.js"

Effect.gen(function*() {
  const ai = yield* OpenAi

  const runFork = yield* FiberSet.makeRuntime()
  const app = express()

  app.get("/", (_req, res) => {
    res.json({ message: "Hello, World!" })
  })

  app.get("/completion", (req, res) => {
    // for each request, we create a new fiber and put it in the fiber set
    // when it finishes, it will be removed from the fiber set
    runFork(Effect.gen(function*() {
      const query = req.query.q as string

      res.writeHead(200, { "Content-Type": "text/plain" })

      yield* ai.completion({
        model: "gpt-4o",
        messages: [{ role: "user", content: query }]
      }).pipe(
        Stream.runForEach((chunk) =>
          Effect.sync(() => {
            res.write(chunk.choices[0].delta.content!)
          })
        )
      )

      res.end()
    }))
  })

  yield* Effect.acquireRelease(
    Effect.sync(() => app.listen(3000)),
    (server) =>
      // to wrap a callback API
      Effect.async((resume) => {
        server.close(() => resume(Effect.void))
      })
  )

  yield* Effect.never
}).pipe(
  Effect.scoped,
  Effect.provide(OpenAi.Default),
  NodeRuntime.runMain
)
