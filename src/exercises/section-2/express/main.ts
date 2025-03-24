import { NodeRuntime } from "@effect/platform-node"
import Sqlite from "better-sqlite3"
import { Cause, Effect, Exit, FiberId, FiberSet, Layer, pipe, Schema, Scope, Stream } from "effect"
import express from "express"

class SqlError extends Schema.TaggedError<SqlError>()("SqlError", {
  cause: Schema.Defect
}) {}

class SqlClient extends Effect.Service<SqlClient>()("SqlClient", {
  scoped: Effect.gen(function*() {
    const db = yield* Effect.acquireRelease(
      Effect.sync(() => new Sqlite(":memory:")),
      (db) => Effect.sync(() => db.close())
    )

    // preparing db when constructing the service (layers will memoize it => will be constructed just one time)
    db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    for (let i = 0; i < 30; i++) {
      db.prepare("INSERT INTO users (name) VALUES (?)").run(`User ${i}`)
    }

    const use = Effect.fn("SqlClient.use")(<A>(f: (db: Sqlite.Database) => A): Effect.Effect<A, SqlError> =>
      Effect.try({
        try: () => f(db),
        catch: (cause) => new SqlError({ cause })
      })
    )

    const query = <A = unknown>(sql: string, ...params: Array<any>): Effect.Effect<Array<A>, SqlError> =>
      use((db) => {
        const stmt = db.prepare<Array<any>, A>(sql)
        if (stmt.reader) {
          return stmt.all(...params) ?? []
        }
        stmt.run(...params)
        return []
      }).pipe(Effect.withSpan("SqlClient.query", { attributes: { sql } }))

    const stream = <A>(sql: string, ...params: Array<any>): Stream.Stream<A, SqlError> =>
      use((db) => {
        const stmt = db.prepare<Array<any>, A>(sql)
        return Stream.fromIterable(stmt.iterate(...params))
      }).pipe(
        Stream.unwrap,
        Stream.withSpan("SqlClient.stream", { attributes: { sql } })
      )

    return {
      use,
      query,
      stream
    } as const
  })
}) {}

class ExpressApp extends Effect.Service<ExpressApp>()("ExpressApp", {
  scoped: Effect.gen(function*() {
    const app = express()
    app.use(express.json())
    const scope = yield* Effect.scope

    yield* Effect.acquireRelease(
      Effect.sync(() =>
        app.listen(3000, () => {
          console.log("Server listening on http://localhost:3000")
        })
      ),
      (server) =>
        Effect.async((resume) => {
          server.close(() => resume(Effect.void))
        })
    )

    // addRoute is a helper function to add routes to the express app
    //
    // It handles the following:
    //
    // - Tracking the Effect fibers using a FiberSet
    // - Adding tracing information to each request
    // - Handling cases where the response has not been sent
    // - Logging any unhandled errors excluding interruptions
    // - Interrupting the fiber if the request is closed
    //
    const addRoute = <E, R>(
      method: "get" | "post" | "put" | "delete",
      path: string,
      handler: (req: express.Request, res: express.Response) => Effect.Effect<void, E, R>
    ): Effect.Effect<void, never, R> =>
      Effect.gen(function*() {
        // create runFork attached to the Layer scope
        const runFork = yield* FiberSet.makeRuntime<R>().pipe(
          Scope.extend(scope)
        )

        app[method](path, (req, res) => {
          const fiber = handler(req, res).pipe(
            // add tracing information to each request
            Effect.withSpan(`Express.route(${method}, ${path})`),
            // handle cases where the response has not been sent
            Effect.onExit((exit) => {
              if (!res.headersSent) {
                res.writeHead(Exit.isSuccess(exit) ? 204 : 500)
              }
              if (!res.writableEnded) {
                res.end()
              }
              // log any unhandled errors excluding interruptions
              if (Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause)) {
                return Effect.annotateLogs(Effect.logWarning("Unhandled error in route", exit.cause), {
                  method,
                  path,
                  headers: req.headers
                })
              }
              return Effect.void
            }),
            runFork
          )

          // if the request is closed, interrupt the fiber
          req.on("close", () => {
            fiber.unsafeInterruptAsFork(FiberId.none)
          })
        })
      })

    return { app, addRoute } as const
  })
}) {}

// Routes doesn't do anything besides side effects => Layer.launch could be used
// Routes has type Layer<never, never, never>
const Routes = Layer.scopedDiscard(Effect.gen(function*() {
  const { addRoute } = yield* ExpressApp
  const sql = yield* SqlClient

  yield* addRoute(
    "get",
    "/users",
    Effect.fnUntraced(function*(req, res) {
      // consider a UserRepo service which uses the sql service

      const users = yield* sql.query("SELECT * FROM users").pipe(
        Effect.catchAll((e) =>
          pipe(
            Effect.logError("Error fetching users", e),
            Effect.andThen(Effect.failSync(() => res.status(500).send(e.message)))
          )
        )
      )

      res.json(users)
    })
  )

  yield* addRoute(
    "post",
    "/users",
    Effect.fnUntraced(function*(req, res) {
      const { name } = req.body
      const id = yield* sql.query("INSERT INTO users (name) VALUES (?)", name)
      const user = yield* sql.query("SELECT * FROM users WHERE id = ?", id)
      res.json(user)
    })
  )

  yield* addRoute(
    "get",
    "/users/:id",
    Effect.fnUntraced(function*(req, res) {
      const user = yield* sql.query("SELECT * FROM users WHERE id = ?", req.params.id)
      if (!user) {
        res.status(404).end()
        return
      }
      res.json(user)
    })
  )
})).pipe(Layer.provide([ExpressApp.Default, SqlClient.Default])) // prefer immediate (local) providing of the dependencies

NodeRuntime.runMain(Layer.launch(Routes))

// TODO list:
//
// 1. Wrap express app with Effect, without changing any the request handlers
// 2. Add an route for updating a user by id, using a Effect request handler
//   2.1. Use `SqlClient` from previous exercise to interact with sqlite database
// 3. Convert the existing request handlers to use Effect
//
// Optional challenges:
//
// - Add error handling to return 500 status code on database errors, and log
//   the errors
//   - Return 404 status code when a user is not found
//
// - Add tracing spans for each request
//
// - Parse the request parameters using "effect/Schema"
//   - Encode the responses using "effect/Schema"
//
// - Migrate to `HttpApi` from "@effect/platform"
//
// Advanced challenges:
//
// - Create a SqlClient .withTransaction method, and use it for the POST /users
//   route
//   - Bonus points if it supports nested transactions with savepoints
//

// setup sqlite

// const db = new Sqlite(":memory:")

// // setup express

// const app = express()

// // inject db into express context
// declare global {
//   namespace Express {
//     interface Locals {
//       db: Sqlite.Database
//     }
//   }
// }
// app.locals.db = db

// app.use(express.json())

// app.get("/users", async (_req, res) => {
//   const users = db.prepare("SELECT * FROM users").all()
//   res.json(users)
// })

// app.post("/users", async (req, res) => {
//   const { name } = req.body
//   const id = db.prepare("INSERT INTO users (name) VALUES (?)").run(name).lastInsertRowid
//   const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id)
//   res.json(user)
// })

// app.get("/users/:id", async (req, res) => {
//   const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id)
//   if (!user) {
//     res.status(404).end()
//     return
//   }
//   res.json(user)
// })

// app.listen(3000, () => {
//   console.log("Server listening on http://localhost:3000")
// })
