import { NodeHttpClient } from "@effect/platform-node"
import { Layer } from "effect"
import { ImmunityTokenManager, makeImmunityTokenManager } from "./shared/services/ImmunityTokenManager.js"
import { makePunDistributionNetwork, PunDistributionNetwork } from "./shared/services/PunDistributionNetwork.js"
import { makePunsterClient, PunsterClient } from "./shared/services/PunsterClient.js"

/**
 * We are temporarily going to go back to using the layers from our shared
 * codebase just to reduce noise. However, the concepts we will explore in this
 * exercise can be applied in the exact same way to layers created with
 * `Effect.Service`.
 *
 * **Todo List**:
 *   - Remove the `Scope` dependency from the `MainLayer` layer
 *
 * **Hint**: Think about how we can "embed" the lifetime of a service into the
 *           process of layer construction
 *
 * **Bonus Objectives**
 *
 *   **Dependency Management**
 *     - Eliminate dependencies for each layer locally
 *       - I.e. The third type parameter of `Layer` should not contain any of
 *         our Pun-ishment Protocol services (it might contain others)
 *     - Stretch Goal: Eliminate the `HttpClient` dependency from the `MainLayer`
 *       using the `NodeHttpClient` module from `@effect/platform-node`
 *
 *   **Error Handling**
 *     - Provide some mechanism of error handling for `Layer` errors
 */

export const ImmunityTokenManagerLayer = Layer.effect(
  ImmunityTokenManager,
  makeImmunityTokenManager
)

export const PunsterClientLayer = Layer.effect(
  PunsterClient,
  makePunsterClient
).pipe(Layer.provide(ImmunityTokenManagerLayer))

export const PunDistributionNetworkLayer = Layer.effect(
  PunDistributionNetwork,
  makePunDistributionNetwork
).pipe(Layer.provide(PunsterClientLayer))

export const MainLayer = Layer.mergeAll(
  ImmunityTokenManagerLayer,
  PunsterClientLayer,
  PunDistributionNetworkLayer
).pipe(
  Layer.provide(NodeHttpClient.layerUndici),
  Layer.provide(Layer.scope)
)

const _test = Layer.build(MainLayer)
//    ^?
