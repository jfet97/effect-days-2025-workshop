import { Effect } from "effect"
import { Misbehavior, Pun } from "./shared/domain/models.js"
import { PunsterClient } from "./shared/services/PunsterClient.js"

/**
 * You are working on writing tests for the `PunsterClient` and want to
 * provide a mock implementation of the client to your tests that returns
 * static data.
 *
 * **Todo List**:
 *   - Write a mock implementation of the `PunsterClient` which
 *     - Always returns the `testPun` from `createPun`
 *     - Always returns the `testEvaluation` from `evaluatePun`
 *   - Provide the mock implementation to the `main` program
 */

const testPun = Pun.make({
  setup: "The setup",
  punchline: "The punchline",
  groanPotential: 0.5
})

const testEvaluation = "Pun Evaluation Report"

export const main = Effect.gen(function*() {
  const punster = yield* PunsterClient
  yield* punster.createPun(Misbehavior.make({
    childName: "Testy McTesterson",
    category: "TestCategory",
    description: "A test misbehavior",
    severity: 1
  }))
}).pipe(
  Effect.provideService(PunsterClient, {
    createPun: () => Effect.succeed(testPun),
    evaluatePun: () => Effect.succeed(testEvaluation)
  })
)
