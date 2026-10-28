/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    newAccount: {
      store: typeof routes['auth.new_account.store']
    }
    accessTokens: {
      store: typeof routes['auth.access_tokens.store']
    }
  }
  profile: {
    profile: {
      show: typeof routes['profile.profile.show']
    }
    accessTokens: {
      destroy: typeof routes['profile.access_tokens.destroy']
    }
  }
  channels: {
    index: typeof routes['channels.index']
    discover: typeof routes['channels.discover']
    store: typeof routes['channels.store']
    join: typeof routes['channels.join']
    members: typeof routes['channels.members']
    seen: typeof routes['channels.seen']
    invite: typeof routes['channels.invite']
    revoke: typeof routes['channels.revoke']
    kick: typeof routes['channels.kick']
    leave: typeof routes['channels.leave']
    destroy: typeof routes['channels.destroy']
    command: typeof routes['channels.command']
  }
}
