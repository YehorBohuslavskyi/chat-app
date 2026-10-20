import { createMockService } from './mock/workspace.js'

export {
  inactiveDays,
  kickThreshold,
  notificationModes,
  statuses
} from './mock/workspace.js'

let storage
let session
try {
  storage = globalThis.localStorage
  session = globalThis.sessionStorage
} catch {}
export const workspaceService = createMockService({ storage, session })
