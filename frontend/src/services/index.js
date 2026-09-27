import { createMockService } from './mock/workspace.js'

// Replace this adapter with HTTP services when the backend contract is agreed.
let storage
let session
try {
  storage = globalThis.localStorage
  session = globalThis.sessionStorage
} catch {
  /* Storage is optional for the local prototype. */
}
export const workspaceService = createMockService({ storage, session })
