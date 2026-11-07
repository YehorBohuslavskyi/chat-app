import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApiService } from '../src/services/api/workspace.js'

function storage() {
  const values = new Map()
  return {
    getItem: key => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  }
}
const response = (data, status = 200) =>
  new Response(JSON.stringify({ data }), { status })
const profile = {
  id: 1,
  nickname: 'ada',
  firstName: 'Ada',
  lastName: 'Lovelace'
}

test('registration maps form fields and stores only the token; reload restores via API', async () => {
  const session = storage()
  const requests = []
  const fetcher = async (url, options) => {
    requests.push({ url, ...options })
    return response(
      url.endsWith('/auth/signup')
        ? { user: profile, token: 'test-token' }
        : profile
    )
  }
  const service = createApiService({ session, fetcher })
  const user = await service.register({
    firstName: 'Ada',
    lastName: 'Lovelace',
    nickName: 'ADA',
    email: 'ada@example.com',
    password: 'test-password',
    confirmation: 'test-password'
  })
  assert.equal(user.id, '1')
  assert.equal(user.nickName, 'ada')
  assert.equal(user.status, null)
  const body = JSON.parse(requests[0].body)
  assert.equal(body.nickname, 'ada')
  assert.equal(body.passwordConfirmation, 'test-password')
  assert.equal(requests[0].headers.Authorization, undefined)
  const reloaded = createApiService({ session, fetcher })
  assert.equal(reloaded.sessionUser(), null)
  assert.equal((await reloaded.restoreSession()).id, '1')
  assert.equal(requests[1].headers.Authorization, 'Bearer test-token')
})

test('expired tokens clear the session; network failures preserve it for retry', async () => {
  const session = storage()
  session.setItem('sideby-api-token-v1', 'test-token')
  let mode = 'network'
  const service = createApiService({
    session,
    fetcher: async () => {
      if (mode === 'network') throw new Error('connection refused')
      return new Response(
        JSON.stringify({ errors: [{ message: 'Expired' }] }),
        { status: 401 }
      )
    }
  })
  await assert.rejects(service.restoreSession(), /Could not reach Sideby/)
  assert.equal(session.getItem('sideby-api-token-v1'), 'test-token')
  let expired = 0
  service.onSessionExpired(() => expired++)
  mode = 'expired'
  assert.equal(await service.restoreSession(), null)
  assert.equal(session.getItem('sideby-api-token-v1'), undefined)
  assert.equal(expired, 1)
})

test('channels map numeric IDs and unseen invitations, and acknowledge through the API', async () => {
  const session = storage()
  session.setItem('sideby-api-token-v1', 'test-token')
  const calls = []
  const service = createApiService({
    session,
    fetcher: async (url, options) => {
      calls.push({ url, ...options })
      if (url.endsWith('/account/profile')) return response(profile)
      if (url.endsWith('/members')) return response([profile])
      if (url.endsWith('/seen')) return response({ seen: true })
      return response([
        {
          id: 2,
          adminId: 1,
          name: 'room',
          type: 'private',
          invitationSeen: false
        }
      ])
    }
  })
  await service.restoreSession()
  const [channel] = await service.listChannels()
  assert.equal(channel.id, '2')
  assert.equal(channel.adminId, '1')
  assert.deepEqual(channel.invitedIds, ['1'])
  await service.members('2')
  const seen = await service.acknowledgeInvitation('2')
  assert.deepEqual(seen.memberIds, ['1'])
  assert.deepEqual(seen.invitedIds, [])
  assert.equal(calls.at(-1).method, 'POST')
})

test('a late protected response cannot revive an old account session', async () => {
  const session = storage()
  session.setItem('sideby-api-token-v1', 'test-token')
  let resolveProfile
  const service = createApiService({
    session,
    fetcher: async url => {
      if (url.endsWith('/account/profile'))
        return new Promise(resolve => {
          resolveProfile = resolve
        })
      return response({ message: 'Logged out' })
    }
  })
  const restore = service.restoreSession()
  await service.logout()
  resolveProfile(response(profile))
  await assert.rejects(restore, /session changed/)
  assert.equal(service.sessionUser(), null)
})

test('moderation adapts outcomes and unavailable messaging never reports success', async () => {
  let input
  const service = createApiService({
    fetcher: async (url, options) => {
      input = JSON.parse(options.body)
      return response({ banned: true, votes: 0 })
    }
  })
  assert.deepEqual(await service.kick('2', '@ADA'), {
    banned: true,
    votes: 0,
    outcome: 'banned',
    nickName: 'ada',
    needed: 3
  })
  assert.equal(input.nickname, 'ada')
  await assert.rejects(service.sendMessage('2', 'hello'), /not available/)
})
