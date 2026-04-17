/**
 * Zod-Schemata für API-Inputs.
 *
 * Warum zentral? Konsistente Validierung + automatische ZodError-Behandlung
 * via `apiHandler` in `lib/api-handler.ts`.
 *
 * Konvention:
 *  - ein Schema pro Route/Action
 *  - Längenlimits grundsätzlich setzen (DoS-Schutz)
 *  - Domains/URL-Allowlists nutzen, wo sinnvoll
 */

export * from "./common"
export * from "./bookings"
export * from "./profile"
export * from "./messages"
export * from "./upload"
