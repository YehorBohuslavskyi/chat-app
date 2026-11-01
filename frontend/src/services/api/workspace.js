const sessionKey = 'sideby-api-token-v1'
const normalize = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^[@#]/, '')

export function createApiService({
  baseUrl = '/api/v1',
  session,
  fetcher = globalThis.fetch
} = {}) {
  let token = null
  try {
    token = session?.getItem(sessionKey) || null
  } catch {
    /* Storage may be blocked. */
  }
  let user = null
  let generation = 0
  const authListeners = new Set()
  const cache = new Map()

  function setToken(value) {
    token = value
    try {
      if (value) session?.setItem(sessionKey, value)
      else session?.removeItem(sessionKey)
    } catch {
      /* The current tab can still use its in-memory session. */
    }
  }
  function clearSession() {
    generation++
    setToken(null)
    user = null
    cache.clear()
    authListeners.forEach(listener => listener())
  }
  async function request(
    path,
    { method = 'GET', body, authenticated = true } = {}
  ) {
    const currentToken = token
    const currentGeneration = generation
    let response
    try {
      response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(authenticated && currentToken
            ? { Authorization: `Bearer ${currentToken}` }
            : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000)
      })
    } catch {
      throw new Error(
        'Could not reach Sideby. Check your connection and try again.'
      )
    }
    if (authenticated && currentGeneration !== generation)
      throw new Error('Your session changed. Please try again.')
    const payload = await response.json().catch(() => null)
    if (authenticated && currentGeneration !== generation)
      throw new Error('Your session changed. Please try again.')
    if (!response.ok) {
      if (response.status === 401 && authenticated && token === currentToken)
        clearSession()
      const fallback =
        response.status === 401
          ? authenticated
            ? 'Your session has expired. Please sign in again.'
            : 'Your email and password do not match.'
          : response.status >= 500
            ? 'Something went wrong. Please try again.'
            : 'The request could not be completed.'
      const error = new Error(
        response.status >= 500
          ? fallback
          : payload?.errors
              ?.map(item => item.message)
              .filter(Boolean)
              .join(' ') || fallback
      )
      error.status = response.status
      throw error
    }
    if (!payload)
      throw new Error(
        'Sideby returned an unexpected response. Please try again.'
      )
    return payload.data ?? payload
  }
  const mapUser = value => ({
    ...value,
    id: String(value.id),
    nickName: value.nickname,
    color: '#7061c7',
    status: null
  })
  function mapChannel(value) {
    const id = String(value.id)
    const channel = {
      ...value,
      id,
      adminId: String(value.adminId),
      memberIds: cache.get(id)?.memberIds || [],
      invitedIds: value.invitationSeen === false && user ? [user.id] : [],
      kickVotes: {}
    }
    cache.set(id, channel)
    return channel
  }
  async function authenticate(path, input) {
    const result = await request(path, {
      method: 'POST',
      body: input,
      authenticated: false
    })
    generation++
    cache.clear()
    setToken(result.token)
    user = mapUser(result.user)
    return user
  }
  const post = (path, body) => request(path, { method: 'POST', body })
  const unavailable = async () => {
    throw new Error('This feature is not available yet.')
  }

  return {
    sessionUser: () => user,
    onSessionExpired(listener) {
      authListeners.add(listener)
      return () => authListeners.delete(listener)
    },
    async restoreSession() {
      if (!token) return null
      try {
        user = mapUser(await request('/account/profile'))
        return user
      } catch (error) {
        if (error.status === 401) return null
        throw error
      }
    },
    login: input =>
      authenticate('/auth/login', {
        email: input.email,
        password: input.password
      }),
    register: input =>
      authenticate('/auth/signup', {
        firstName: input.firstName,
        lastName: input.lastName,
        nickname: normalize(input.nickName),
        email: input.email,
        password: input.password,
        passwordConfirmation: input.confirmation
      }),
    async logout() {
      try {
        if (token) await post('/account/logout')
      } catch (error) {
        if (error.status !== 401) throw error
      }
      clearSession()
    },
    async listChannels() {
      const rows = await request('/channels')
      const ids = new Set(rows.map(row => String(row.id)))
      for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id)
      return rows.map(mapChannel)
    },
    async browseChannels(query = '') {
      return (
        await request(`/channels/discover?q=${encodeURIComponent(query)}`)
      ).map(mapChannel)
    },
    async createChannel(input) {
      return mapChannel(
        await post('/channels', { ...input, name: normalize(input.name) })
      )
    },
    async joinChannel(name, type = 'public') {
      return mapChannel(
        await post('/channels/join', { name: normalize(name), type })
      )
    },
    async acknowledgeInvitation(id) {
      await post(`/channels/${id}/seen`)
      const channel = cache.get(String(id))
      if (channel) {
        channel.invitedIds = []
        channel.invitationSeen = true
      }
      return channel
    },
    async members(id) {
      const members = (await request(`/channels/${id}/members`)).map(mapUser)
      const channel = cache.get(String(id))
      if (channel) channel.memberIds = members.map(member => member.id)
      return members
    },
    async leaveChannel(id, deleteOnly = false) {
      const result = await request(
        `/channels/${id}${deleteOnly ? '' : '/leave'}`,
        { method: deleteOnly ? 'DELETE' : 'POST' }
      )
      cache.delete(String(id))
      return result
    },
    invite: (id, nickname) =>
      post(`/channels/${id}/invite`, { nickname: normalize(nickname) }),
    async kick(id, nickname) {
      const result = await post(`/channels/${id}/kick`, {
        nickname: normalize(nickname)
      })
      return {
        ...result,
        outcome: result.banned ? 'banned' : 'voted',
        nickName: normalize(nickname),
        needed: 3
      }
    },
    async revoke(id, nickname) {
      await post(`/channels/${id}/revoke`, { nickname: normalize(nickname) })
      return { nickName: normalize(nickname) }
    },
    onExternalChange: () => () => {},
    messageHistory: unavailable,
    sendMessage: unavailable,
    setStatus: unavailable,
    setNotificationMode: unavailable,
    incoming: unavailable,
    drafts: unavailable,
    setDraft: unavailable,
    simulateIncoming: unavailable,
    simulateTyping: unavailable,
    simulateInactivity: unavailable
  }
}
