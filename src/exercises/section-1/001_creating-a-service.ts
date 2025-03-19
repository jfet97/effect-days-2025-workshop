import type { Effect } from "effect"
import { Context } from "effect"

// The "./shared/domain/*.js" imports provide domain-specific types and errors
// used across the Pun-ishment Protocol application. They are imported from a
// shared module to save time and avoid redefining them
import type {
  ChildImmuneError,
  MalformedPunError,
  NoChannelAvailableError,
  NoTokenAvailableError,
  PunsterFetchError
} from "./shared/domain/errors.js"
import type { Channel, Misbehavior, Pun } from "./shared/domain/models.js"

/**
 * **Todo List**:
 *   - Create a unique type-level and runtime identifier for each of the
 *     services specified below.
 *
 * **Hint**: You may need to import the `Context` module from Effect!
 */

/**
 * The Punster Client is responsible for interacting with PUNSTER to create puns
 * and perform evaluations on pun delivery.
 */
export interface PunsterClientShape {
  readonly createPun: (
    misbehavior: Misbehavior
  ) => Effect.Effect<Pun, ChildImmuneError | MalformedPunError | PunsterFetchError>
  readonly evaluatePun: (
    pun: Pun,
    misbehavior: Misbehavior,
    channel: Channel
  ) => Effect.Effect<string, PunsterFetchError>
}

// idea: use the path to the file + service name as the tag name to make it unique
export class PunsterClient extends Context.Tag("PunsterClient")<
  PunsterClient,
  PunsterClientShape
>() {}

/**
 * The Pun Distribution Network (PDN) is responsible for controlling access to
 * the most optimal communication channels for delivering puns.
 */
export interface PunDistributionNetworkShape {
  readonly getChannel: (misbehavior: Misbehavior) => Effect.Effect<Channel, NoChannelAvailableError>
  readonly deliverPun: (pun: Pun, misbehavior: Misbehavior, channel: Channel) => Effect.Effect<string>
}

export class PunDistributionNetwork extends Context.Tag("PunDistributionNetwork")<
  PunDistributionNetwork,
  PunDistributionNetworkShape
>() {}

/**
 * The Immunity Token Manager is a service that allows children to earn pun
 * immunity tokens, providing positive reinforcement for good behavior. All
 * tokens are reset each day at `00:00`.
 */
export interface ImmunityTokenManagerShape {
  readonly getBalance: (childName: string) => Effect.Effect<number>
  readonly awardToken: (childName: string, options: { readonly reason: string }) => Effect.Effect<void>
  readonly useToken: (childName: string) => Effect.Effect<number, NoTokenAvailableError>
}

export class ImmunityTokenManager extends Context.Tag("ImmunityTokenManager")<
  ImmunityTokenManager,
  ImmunityTokenManagerShape
>() {}
