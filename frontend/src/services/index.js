import { createMockService } from './mock/workspace.js'
import { createApiService } from './api/workspace.js'

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
export const isDemo = import.meta.env.WORKSPACE_MODE === 'demo'
export const capabilities = {
  messages: true,
  presence: isDemo,
  notifications: isDemo,
  drafts: isDemo
}
export const workspaceService = isDemo
  ? createMockService({ storage, session })
  : createApiService({ baseUrl: import.meta.env.API_BASE_URL, session })
