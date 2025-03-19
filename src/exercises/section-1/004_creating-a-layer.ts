// The shared service modules also export pre-defined constructors, given that
// we don't need to know how the services are implemented to use them
import { NodeHttpClient } from "@effect/platform-node"
import { Layer } from "effect"
import { ImmunityTokenManager, makeImmunityTokenManager } from "./shared/services/ImmunityTokenManager.js"
import { makePunDistributionNetwork, PunDistributionNetwork } from "./shared/services/PunDistributionNetwork.js"
import { makePunsterClient, PunsterClient } from "./shared/services/PunsterClient.js"

/**
 * You have implemented service constructors for the three services in the
 * Pun-ishment Protocol application and are now ready to create `Layer`s for
 * them.
 *
 * **Todo List**:
 *   - Define `Layer`s for each of the services in our Pun-ishment Protocol app
 *     - `PunDistributionNetworkLayer`
 *     - `PunsterClientLayer`
 *     - `ImmunityTokenManagerLayer`
 *   - Use the provided service constructors to implement your `Layer`s
 *
 * **Hint**: You'll probably want to import the `Layer` module from `"effect"`!
 *
 * **Bonus Objectives**
 *
 *   **Dependency Management**
 *     - Eliminate dependencies for each layer locally
 *       - I.e. The third type parameter of `Layer` should not contain any of
 *         our Pun-ishment Protocol services (it might contain others)
 *     - Stretch Goal: Compose all layers into one `MainLayer`
 *     - Super-Stretch Goal: Eliminate the `HttpClient` dependency from the
 *       `MainLayer` using the `NodeHttpClient` module from `@effect/platform-node`
 *
 *   **Error Handling**
 *     - Provide some mechanism of error handling for `Layer` errors
 */

/* Uncomment the below to implement */
export const ImmunityTokenManagerLayer = Layer.effect(
  ImmunityTokenManager,
  makeImmunityTokenManager
)

/* Uncomment the below to implement */
export const PunsterClientLayer = Layer.effect(
  PunsterClient,
  makePunsterClient
).pipe(
  Layer.provide(ImmunityTokenManagerLayer)
)

/* Uncomment the below to implement */
export const PunDistributionNetworkLayer = Layer.effect(
  PunDistributionNetwork,
  makePunDistributionNetwork
).pipe(
  Layer.provide(PunsterClientLayer)
)

export const MainLayer = Layer.mergeAll(
  ImmunityTokenManagerLayer,
  PunsterClientLayer,
  PunDistributionNetworkLayer
).pipe(Layer.provide(NodeHttpClient.layer))
