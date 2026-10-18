import { createFixtures, demoCredentials } from './fixtures.js'

// v2: channels gained bannedIds and kickVotes, so older saved data is not reused.
// v3: channels gained lastMessageAt (v2 added bannedIds and kickVotes),
// so older saved data is not reused.
const key = 'loop-prototype-v3'
const sessionKey = 'loop-session-v1'
// Unsent drafts are live-only, so they live apart from the workspace data.
const draftKey = 'loop-drafts-v1'
const copy = value => JSON.parse(JSON.stringify(value))
const normalize = value =>
  String(value || '')
    .trim()
    .toLowerCase()
const validName = /^[a-z0-9][a-z0-9_-]{1,31}$/
// Distinct member votes needed to ban someone from a public channel.
export const kickThreshold = 3
export const statuses = ['online', 'dnd', 'offline']
// Channels without a message for longer than this are deleted.
export const inactiveDays = 30
const dayMs = 24 * 60 * 60 * 1000
export const notificationModes = ['all', 'mentions']
// Sample lines for the "receive a message" demo control.
// "Demo: a teammate types" scripts: type `first`, backspace `erase` characters,
// then type `rest`. The result is sent as a message.
const typingScripts = [
  { first: 'I can take the relaese', erase: 7, rest: 'release notes tonight.' },
  {
    first: 'Does anyone know why the build is sloe',
    erase: 4,
    rest: 'slow today?'
  },
  {
    first: 'Let us meet on Thursdya',
    erase: 8,
    rest: 'Thursday at 10 to plan the demo.'
  }
]
const typingStepMs = 110
const incomingLines = [
  'Quick update: the latest build is ready to try.',
  'Has anyone had a chance to look at this yet?',
  'Thanks, that helps a lot!',
  'I will pick this up after lunch.',
  'Small win: the tests are green again.'
]

// Local prototype only. Production authentication and authorization belong on the server.
export function createMockService({ storage, session, latency = 140 } = {}) {
  let data = createFixtures()
  let userId = null
  const listeners = new Set()
  // Tells subscribers that shared data changed (another tab, or a simulated teammate).
  // `kind` is 'data' (messages, channels, users) or 'drafts' (live typing).
  const notify = (kind = 'data') =>
    listeners.forEach(listener => listener(kind))
  // { [channelId]: { [userId]: { text, updatedAt } } }
  let drafts = {}
  try {
    drafts = JSON.parse(storage?.getItem(draftKey) || '{}')
  } catch {
    drafts = {}
  }
  const saveDrafts = () => {
    try {
      storage?.setItem(draftKey, JSON.stringify(drafts))
    } catch {
      /* Drafts still work in this tab without storage. */
    }
  }
  const writeDraft = (channelId, authorId, text) => {
    drafts[channelId] ||= {}
    if (text.trim())
      drafts[channelId][authorId] = {
        text,
        updatedAt: new Date().toISOString()
      }
    else delete drafts[channelId][authorId]
    saveDrafts()
  }
  // Senders currently "typing" in a demo, as `${channelId}:${userId}`.
  const typingNow = new Set()
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
    if (event.key === draftKey) {
      try {
        drafts = JSON.parse(event.newValue || '{}')
      } catch {
        return
      }
      notify('drafts')
      return
    }
    if (event.key !== key || !event.newValue) return
    try {
      data = JSON.parse(event.newValue)
    } catch {
      return
    }
    notify('data')
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
  // Every new message goes through here, so any message resets the expiry clock.
  const addMessage = (channelId, senderId, body) => {
    const message = {
      id: ++data.sequence,
      channelId,
      senderId,
      body,
      createdAt: new Date().toISOString()
    }
    data.messages.push(message)
    const channel = data.channels.find(item => item.id === channelId)
    if (channel) channel.lastMessageAt = message.createdAt
    return message
  }
  // Expired: no message for MORE than inactiveDays (exactly 30 days is not yet).
  const isExpired = (channel, now) =>
    now - Date.parse(channel.lastMessageAt) > inactiveDays * dayMs
  // Lazy expiration: a server would run this on a schedule; the mock runs it
  // before every request, so an expired channel is never returned.
  const expireInactive = () => {
    const now = Date.now()
    const expired = new Set(
      data.channels
        .filter(channel => isExpired(channel, now))
        .map(channel => channel.id)
    )
    if (!expired.size) return
    // Deleting the channel record is what frees its name for create().
    data.channels = data.channels.filter(channel => !expired.has(channel.id))
    data.messages = data.messages.filter(
      message => !expired.has(message.channelId)
    )
    for (const id of expired) delete drafts[id]
    save()
    saveDrafts()
  }
  const run = async action => {
    if (latency) await new Promise(resolve => setTimeout(resolve, latency))
    expireInactive()
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
      kickVotes: {},
      // A new channel counts as active from its creation.
      lastMessageAt: new Date().toISOString()
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
        // Signing out abandons every unsent draft of this user.
        if (userId) for (const id in drafts) writeDraft(id, userId, '')
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
    // `before` pages backwards (older history); `after` pages forwards (missed messages).
    messageHistory: (id, { before = null, after = null, limit = 20 } = {}) =>
      run(() => {
        channelFor(id)
        limit = Math.min(Math.max(Number(limit) || 20, 1), 50)
        const messages = data.messages.filter(
          message =>
            message.channelId === id && (before === null || message.id < before)
        )
        // `after` continues forwards from a known message, so it takes the oldest
        // page of newer messages; otherwise the newest page closest to `before`.
        const matching =
          after === null
            ? messages
            : messages.filter(message => message.id > after)
        const items =
          after === null ? matching.slice(-limit) : matching.slice(0, limit)
        return {
          items: items.map(message => ({
            ...message,
            sender: data.users.find(user => user.id === message.senderId)
          })),
          hasMore: matching.length > items.length
        }
      }),
    setStatus: status =>
      run(() => {
        const user = requireUser()
        if (!statuses.includes(status))
          throw new Error('Choose online, do not disturb, or offline.')
        user.status = status
        save()
        return user
      }),
    setNotificationMode: mode =>
      run(() => {
        const user = requireUser()
        if (!notificationModes.includes(mode))
          throw new Error('Choose all messages or mentions only.')
        user.notifications = mode
        save()
        return user
      }),
    // Messages from other people in the user's channels with an id above `after`.
    // Ids are one global sequence, so `cursor` (the newest id) covers every channel.
    // `after = null` returns only the cursor: a baseline that never notifies.
    incoming: (after = null) =>
      run(() => {
        const user = requireUser()
        const mine = new Map(
          data.channels
            .filter(channel => channel.memberIds.includes(user.id))
            .map(channel => [channel.id, channel.name])
        )
        const items =
          after === null
            ? []
            : data.messages.filter(
                message =>
                  message.id > after &&
                  message.senderId !== user.id &&
                  mine.has(message.channelId)
              )
        return {
          items: items.map(message => ({
            ...message,
            channelName: mine.get(message.channelId),
            sender: data.users.find(item => item.id === message.senderId)
          })),
          cursor: data.sequence
        }
      }),
    // Demo control: a random other member posts in the channel. The message is
    // stored like any other; delivery to this tab goes through notify().
    simulateIncoming: (id, { mention = false } = {}) =>
      run(() => {
        const channel = channelFor(id)
        const senders = channel.memberIds.filter(item => item !== userId)
        if (!senders.length)
          throw new Error(
            'Nobody else is in this channel yet. Invite someone first.'
          )
        addMessage(
          id,
          senders[Math.floor(Math.random() * senders.length)],
          (mention ? `@${currentUser().nickName} ` : '') +
            incomingLines[Math.floor(Math.random() * incomingLines.length)]
        )
        save()
        // After this request resolves, like a server push arriving a moment later.
        setTimeout(() => notify('data'))
        return { channelId: id }
      }),
    // Other members' unsent text in the channel (never the caller's own).
    drafts: id =>
      run(() => {
        const channel = channelFor(id)
        return Object.entries(drafts[id] || {})
          .filter(
            ([authorId, draft]) =>
              authorId !== userId &&
              draft.text &&
              channel.memberIds.includes(authorId)
          )
          .map(([authorId, draft]) => ({
            user: data.users.find(user => user.id === authorId),
            text: draft.text,
            updatedAt: draft.updatedAt
          }))
          .filter(draft => draft.user)
      }),
    // The caller's draft; empty text clears it ("stopped typing").
    setDraft: (id, text) =>
      run(() => {
        channelFor(id)
        writeDraft(id, userId, String(text ?? '').slice(0, 4000))
        return null
      }),
    // Demo control: a teammate types (with a typo they fix), pauses, and sends.
    // Every keystroke updates their draft and notifies like a server push.
    simulateTyping: id =>
      run(() => {
        const channel = channelFor(id)
        const senders = channel.memberIds.filter(
          item => item !== userId && !typingNow.has(`${id}:${item}`)
        )
        if (!senders.length)
          throw new Error(
            channel.memberIds.length > 1
              ? 'Everyone else here is already typing.'
              : 'Nobody else is in this channel yet. Invite someone first.'
          )
        const senderId = senders[Math.floor(Math.random() * senders.length)]
        const script =
          typingScripts[Math.floor(Math.random() * typingScripts.length)]
        const kept = script.first.slice(0, -script.erase)
        const frames = [
          ...Array.from(script.first, (_, index) =>
            script.first.slice(0, index + 1)
          ),
          ...Array.from({ length: script.erase }, (_, index) =>
            script.first.slice(0, script.first.length - index - 1)
          ),
          ...Array.from(
            script.rest,
            (_, index) => kept + script.rest.slice(0, index + 1)
          )
        ]
        const slot = `${id}:${senderId}`
        typingNow.add(slot)
        const finish = () => {
          typingNow.delete(slot)
          writeDraft(id, senderId, '')
          notify('drafts')
        }
        // Stop if the channel or the sender's membership disappears meanwhile.
        const stillThere = () =>
          data.channels
            .find(item => item.id === id)
            ?.memberIds.includes(senderId)
        let step = 0
        const tick = () => {
          if (!stillThere()) return finish()
          if (step < frames.length) {
            writeDraft(id, senderId, frames[step++])
            notify('drafts')
            setTimeout(tick, typingStepMs)
            return
          }
          addMessage(id, senderId, frames.at(-1))
          save()
          finish()
          notify('data')
        }
        setTimeout(tick, typingStepMs)
        return {
          nickName: data.users.find(user => user.id === senderId).nickName
        }
      }),
    // Demo control: pretend the channel has been quiet for `days` days. The
    // next request's expiry sweep removes it, exactly like real inactivity.
    simulateInactivity: (id, days = inactiveDays + 1) =>
      run(() => {
        const channel = channelFor(id)
        channel.lastMessageAt = new Date(
          Date.now() - days * dayMs
        ).toISOString()
        // Other tabs learn about it through the storage event that save() causes.
        save()
        return { name: channel.name }
      }),
    sendMessage: (id, body) =>
      run(() => {
        channelFor(id)
        body = body.trim()
        if (!body || body.length > 4000)
          throw new Error('Messages must contain 1–4,000 characters.')
        const message = addMessage(id, userId, body)
        save()
        // Sending finishes the draft, even if the client never cleared it.
        writeDraft(id, userId, '')
        return { ...message, sender: currentUser() }
      })
  }
}
