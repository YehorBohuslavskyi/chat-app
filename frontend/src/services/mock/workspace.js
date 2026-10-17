import { createFixtures, demoCredentials } from './fixtures.js'

// v2: channels gained bannedIds and kickVotes, so older saved data is not reused.
const key = 'loop-prototype-v2'
const sessionKey = 'loop-session-v1'
const copy = value => JSON.parse(JSON.stringify(value))
const normalize = value =>
  String(value || '')
    .trim()
    .toLowerCase()
const validName = /^[a-z0-9][a-z0-9_-]{1,31}$/
// Distinct member votes needed to ban someone from a public channel.
export const kickThreshold = 3

// Local prototype only. Production authentication and authorization belong on the server.
export function createMockService({ storage, session, latency = 140 } = {}) {
  let data = createFixtures()
  let userId = null
  const listeners = new Set()
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
  // Another tab (signed in as someone else) saved a change: reload it so this tab
  // sees kicks, bans, and new channels. Lets two tabs act as two users.
  globalThis.addEventListener?.('storage', event => {
    if (event.key !== key || !event.newValue) return
    try {
      data = JSON.parse(event.newValue)
    } catch {
      return
    }
    listeners.forEach(listener => listener())
  })
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
  const findUser = nickName =>
    data.users.find(
      item => item.nickName === normalize(nickName).replace(/^@/, '')
    )
  // A moderation target must be another ordinary member of the channel.
  const targetIn = (channel, nickName) => {
    const target = findUser(nickName)
    if (!target || !channel.memberIds.includes(target.id))
      throw new Error(
        `@${normalize(nickName).replace(/^@/, '')} is not a member of #${channel.name}.`
      )
    if (target.id === userId)
      throw new Error('You cannot remove yourself. Use /cancel to leave.')
    if (target.id === channel.adminId)
      throw new Error('The channel administrator cannot be removed.')
    return target
  }
  const removeMember = (channel, targetId) => {
    channel.memberIds = channel.memberIds.filter(item => item !== targetId)
    channel.invitedIds = channel.invitedIds.filter(item => item !== targetId)
  }
  const ban = (channel, targetId) => {
    removeMember(channel, targetId)
    if (!channel.bannedIds.includes(targetId)) channel.bannedIds.push(targetId)
    delete channel.kickVotes[targetId]
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
      invitedIds: [],
      bannedIds: [],
      kickVotes: {}
    }
    data.channels.push(channel)
    save()
    return channel
  }
  return {
    sessionUser: () => copy(currentUser()),
    // Called when another tab changed the shared data. Returns an unsubscribe function.
    onExternalChange: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
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
        if (channel.bannedIds.includes(user.id))
          throw new Error(
            `You are banned from #${channel.name}. Only its administrator can invite you back.`
          )
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
        const user = findUser(nickName)
        if (!user)
          throw new Error(
            'No one has that nickname. Try mia, noah, sofia, or james.'
          )
        if (channel.memberIds.includes(user.id))
          throw new Error('That person already belongs to this channel.')
        if (channel.bannedIds.includes(user.id)) {
          if (channel.adminId !== userId)
            throw new Error(
              `@${user.nickName} is banned from #${channel.name}. Only the administrator can invite them back.`
            )
          channel.bannedIds = channel.bannedIds.filter(item => item !== user.id)
          delete channel.kickVotes[user.id]
        }

        channel.memberIds.push(user.id)
        channel.invitedIds.push(user.id)
        save()
        return channel
      }),
    // Public channels. The admin bans at once; others add one vote each.
    kick: (id, nickName) =>
      run(() => {
        const channel = channelFor(id)
        if (channel.type !== 'public')
          throw new Error(
            'Use /revoke to remove someone from a private channel.'
          )
        const target = targetIn(channel, nickName)
        if (channel.adminId === userId) {
          ban(channel, target.id)
          save()
          return {
            outcome: 'banned',
            nickName: target.nickName,
            votes: kickThreshold,
            needed: kickThreshold
          }
        }
        const votes = (channel.kickVotes[target.id] ||= [])
        if (votes.includes(userId))
          throw new Error(`You already voted to kick @${target.nickName}.`)
        votes.push(userId)
        const count = votes.length
        if (count >= kickThreshold) ban(channel, target.id)
        save()
        return {
          outcome: count >= kickThreshold ? 'banned' : 'voted',
          nickName: target.nickName,
          votes: count,
          needed: kickThreshold
        }
      }),
    // Private channels. Only the admin; no ban, so a new invitation restores access.
    revoke: (id, nickName) =>
      run(() => {
        const channel = channelFor(id)
        if (channel.type !== 'private')
          throw new Error(
            '/revoke is for private channels. Use /kick in public channels.'
          )
        if (channel.adminId !== userId)
          throw new Error('Only the administrator can revoke access.')
        const target = targetIn(channel, nickName)
        removeMember(channel, target.id)
        save()
        return { nickName: target.nickName }
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
