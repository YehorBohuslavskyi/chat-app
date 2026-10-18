// Keep the previous version intact so an upgrade never destroys its backup.
const currentKey = 'loop-prototype-v3'
const previousKey = 'loop-prototype-v2'

function read(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) || 'null')
    return value &&
      Array.isArray(value.users) &&
      Array.isArray(value.channels) &&
      Array.isArray(value.messages) &&
      value.credentials &&
      typeof value.credentials === 'object'
      ? value
      : null
  } catch {
    return null
  }
}

export function restoreWorkspace(storage, fallback) {
  const current = read(storage, currentKey)
  const previous = read(storage, previousKey)
  if (!previous) return current || fallback

  const data = current || previous
  let changed = !current
  if (!current) {
    for (const channel of data.channels) {
      if (channel.lastMessageAt) continue
      const times = data.messages
        .filter(message => message.channelId === channel.id)
        .map(message => Date.parse(message.createdAt))
        .filter(Number.isFinite)
      // v2 did not record creation dates for empty channels: start their clock now.
      channel.lastMessageAt = new Date(
        times.length ? Math.max(...times) : Date.now()
      ).toISOString()
    }
  } else {
    // A v3 workspace may already have been saved before migration was added.
    // Recover missing accounts only; current channels and credentials take precedence.
    for (const user of previous.users) {
      if (!previous.credentials[user.id]) continue
      if (
        data.users.some(
          existing =>
            existing.id === user.id ||
            existing.email.trim().toLowerCase() ===
              user.email.trim().toLowerCase() ||
            existing.nickName.toLowerCase() === user.nickName.toLowerCase()
        )
      )
        continue
      data.users.push(user)
      data.credentials[user.id] = previous.credentials[user.id]
      changed = true
    }
  }
  if (changed) {
    try {
      storage?.setItem(currentKey, JSON.stringify(data))
    } catch {
      /* Recovered accounts remain usable in memory if storage is unavailable. */
    }
  }
  return data
}
