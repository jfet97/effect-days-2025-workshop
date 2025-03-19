import { NodeHttpClient } from "@effect/platform-node"
import { Layer } from "effect"
import { ImmunityTokenManager, makeImmunityTokenManager } from "./shared/services/ImmunityTokenManager.js"
import { makePunDistributionNetwork, PunDistributionNetwork } from "./shared/services/PunDistributionNetwork.js"
import { makePunsterClient, PunsterClient } from "./shared/services/PunsterClient.js"

/**
 * **Solution Explanation**:
 *
 * To ensure that the lifetime of resources that are acquired during construction
 * of a service are bound to the `Scope` used to build our `Layer` graph, we
 * can use the `Layer.scoped` constructor (or the `scoped` variant of
 * `Effect.Service`).
 *
 * As we build the dependency graph for a `Layer`, we run the constructor for
 * each service. If the service's `Layer` was created with `Layer.scoped`, then
 * we grab the `Scope` that we're sharing to build the `Layer` and extend that
 * `Scope` to resources acquired in that service's constructor.
 *
 * The result of `Layer.build`-ing a `Layer<Services, ServiceConstructorErrors, never>`
 * is an `Effect<Context<Services>, ServiceConstructorErrors, Scope>`, where the
 * `Scope` in the requirements will control the lifetime of all resources
 * acquired during construction of all services in that `Layer`.
 *
 * {@see https://effect-ts.github.io/effect/effect/Layer.ts.html#build}
 */

export const ImmunityTokenManagerLayer = Layer.scoped(
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
).pipe(Layer.provide(NodeHttpClient.layerUndici))

const _test = Layer.build(MainLayer)
//    ^?