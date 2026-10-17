import { createFixtures, demoCredentials } from './fixtures.js'

const key = 'loop-prototype-v1'
const sessionKey = 'loop-session-v1'
const copy = value => JSON.parse(JSON.stringify(value))
const normalize = value =>
  String(value || '')
    .trim()
    .toLowerCase()
const validName = /^[a-z0-9][a-z0-9_-]{1,31}$/

// Local prototype only. Production authentication and authorization belong on the server.
export function createMockService({ storage, session, latency = 140 } = {}) {
  let data = createFixtures()
  let userId = null
  try {
    const saved = storage?.getItem(key)
    if (saved) data = JSON.parse(saved)
    userId = session?.getItem(sessionKey) || null
  } catch {
    /* Private browsing or unavailable storage falls back to this session. */
  }
  const save = () => {
    try {
      storage?.setItem(key, JSON.stringify(data))
    } catch {
      storage = undefined
    } // Keep the prototype usable when storage is full or disabled.
  }
  const currentUser = () => data.users.find(user => user.id === userId) || null
  const requireUser = () => {
    const user = currentUser()
    if (!user) throw new Error('Please sign in to continue.')
    return user
  }
  const channelFor = id => {
    const user = requireUser()
    const channel = data.channels.find(item => item.id === id)
    if (!channel || !channel.memberIds.includes(user.id))
      throw new Error('This channel is no longer available to you.')
    return channel
  }
  const run = async action => {
    if (latency) await new Promise(resolve => setTimeout(resolve, latency))
    return copy(await action())
  }
  const setSession = id => {
    try {
      if (id) session?.setItem(sessionKey, id)
      else session?.removeItem(sessionKey)
    } catch {
      session = undefined
    }
    userId = id
  }
  const digest = async value => {
    const hash = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value)
    )
    return Array.from(new Uint8Array(hash), byte =>
      byte.toString(16).padStart(2, '0')
    ).join('')
  }
  const create = ({ name, type = 'public', description = '' }) => {
    const user = requireUser()
    name = normalize(name).replace(/^#/, '')
    if (!validName.test(name))
      throw new Error(
        'Use 2–32 lowercase letters, numbers, hyphens, or underscores for the channel name.'
      )
    if (!['public', 'private'].includes(type))
      throw new Error('Choose a public or private channel.')
    if (data.channels.some(item => item.name === name))
      throw new Error('A channel with that name already exists.')
    const channel = {
      id: globalThis.crypto.randomUUID(),
      name,
      type,
      description: description.trim().slice(0, 160),
      adminId: user.id,
      memberIds: [user.id],
      invitedIds: []
    }
    data.channels.push(channel)
    save()
    return channel
  }
  return {
    sessionUser: () => copy(currentUser()),
    login: input =>
      run(async () => {
        const user = data.users.find(
          item => item.email === normalize(input.email)
        )
        const demo =
          user?.id === 'alex' && input.password === demoCredentials.password
        if (
          !user ||
          (!demo &&
            data.credentials[user.id] !== (await digest(input.password)))
        )
          throw new Error(
            'That email and password do not match. Please try again.'
          )
        setSession(user.id)
        return user
      }),
    register: input =>
      run(async () => {
        const nickName = normalize(input.nickName)
        const email = normalize(input.email)
        if (!input.firstName?.trim() || !input.lastName?.trim())
          throw new Error('First and last name are required.')
        if (!validName.test(nickName))
          throw new Error(
            'Nickname must be 2–32 letters, numbers, hyphens, or underscores.'
          )
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          throw new Error('Enter a valid email address.')
        if (!input.password || input.password.length < 8)
          throw new Error('Use a password with at least 8 characters.')
        if (
          data.users.some(
            user => user.email === email || user.nickName === nickName
          )
        )
          throw new Error('That email or nickname is already in use.')
        const passwordHash = await digest(input.password)
        // Recheck after asynchronous work so simultaneous registrations cannot duplicate an account.
        if (
          data.users.some(
            user => user.email === email || user.nickName === nickName
          )
        )
          throw new Error('That email or nickname is already in use.')
        const user = {
          id: globalThis.crypto.randomUUID(),
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          nickName,
          email,
          color: '#7061c7',
          status: 'online'
        }
        data.users.push(user)
        data.credentials[user.id] = passwordHash
        data.channels
          .find(channel => channel.id === 'general')
          ?.memberIds.push(user.id)
        save()
        setSession(user.id)
        return user
      }),
    logout: () =>
      run(() => {
        setSession(null)
        return null
      }),
    listChannels: () =>
      run(() => {
        const user = requireUser()
        return data.channels
          .filter(channel => channel.memberIds.includes(user.id))
          .sort(
            (a, b) =>
              Number(b.invitedIds.includes(user.id)) -
              Number(a.invitedIds.includes(user.id))
          )
      }),
    browseChannels: () =>
      run(() => {
        requireUser()
        return data.channels.filter(channel => channel.type === 'public')
      }),
    createChannel: input => run(() => create(input)),
    joinChannel: (name, type = 'public') =>
      run(() => {
        const user = requireUser()
        const channel = data.channels.find(
          item => item.name === normalize(name).replace(/^#/, '')
        )
        if (!channel) return create({ name, type })
        if (channel.type === 'private' && !channel.memberIds.includes(user.id))
          throw new Error(
            'This channel is private. Ask its administrator for an invitation.'
          )
        if (!channel.memberIds.includes(user.id))
          channel.memberIds.push(user.id)
        save()
        return channel
      }),
    acknowledgeInvitation: id =>
      run(() => {
        const channel = channelFor(id)
        channel.invitedIds = channel.invitedIds.filter(item => item !== userId)
        save()
        return channel
      }),
    leaveChannel: (id, deleteOnly = false) =>
      run(() => {
        const channel = channelFor(id)
        const admin = channel.adminId === userId
        if (deleteOnly && !admin)
          throw new Error('Only the administrator can delete this channel.')
        if (admin) {
          data.channels = data.channels.filter(item => item.id !== id)
          data.messages = data.messages.filter(item => item.channelId !== id)
        } else {
          channel.memberIds = channel.memberIds.filter(item => item !== userId)
          channel.invitedIds = channel.invitedIds.filter(
            item => item !== userId
          )
        }
        save()
        return { deleted: admin }
      }),
    invite: (id, nickName) =>
      run(() => {
        const channel = channelFor(id)
        if (channel.type === 'private' && channel.adminId !== userId)
          throw new Error(
            'Only the administrator can invite people to a private channel.'
          )
        const user = data.users.find(
          item => item.nickName === normalize(nickName).replace(/^@/, '')
        )
        if (!user)
          throw new Error(
            'No one has that nickname. Try mia, noah, sofia, or james.'
          )
        if (channel.memberIds.includes(user.id))
          throw new Error('That person already belongs to this channel.')
        channel.memberIds.push(user.id)
        channel.invitedIds.push(user.id)
        save()
        return channel
      }),
    members: id =>
      run(() => {
        const channel = channelFor(id)
        return data.users.filter(user => channel.memberIds.includes(user.id))
      }),
    // Cursor pagination: `before` is the oldest message id the client already has.
    // Ids come from one increasing sequence, so they give a stable, gap-free order.
    messageHistory: (id, { before = null, limit = 20 } = {}) =>
      run(() => {
        channelFor(id)
        limit = Math.min(Math.max(Number(limit) || 20, 1), 50)
        const messages = data.messages.filter(
          message =>
            message.channelId === id && (before === null || message.id < before)
        )
        const items = messages.slice(-limit)
        return {
          items: items.map(message => ({
            ...message,
            sender: data.users.find(user => user.id === message.senderId)
          })),
          hasMore: messages.length > items.length
        }
      }),
    sendMessage: (id, body) =>
      run(() => {
        channelFor(id)
        body = body.trim()
        if (!body || body.length > 4000)
          throw new Error('Messages must contain 1–4,000 characters.')
        const message = {
          id: ++data.sequence,
          channelId: id,
          senderId: userId,
          body,
          createdAt: new Date().toISOString()
        }
        data.messages.push(message)
        save()
        return { ...message, sender: currentUser() }
      })
  }
}
