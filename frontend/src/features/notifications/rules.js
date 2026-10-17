import { isAddressed } from '../chat/utils/mentions.js'

// Pure functions: no Vue, no browser APIs, so they are easy to reason about and test.

// Notify only for someone else's message while the app is hidden, the user is
// not in Do not disturb, and the user's mode allows it.
export function shouldNotify({ message, user, visible }) {
  if (visible) return false
  if (user.status === 'dnd') return false
  if (message.senderId === user.id) return false
  // Accounts created before this setting existed have no value: treat as 'all'.
  if ((user.notifications ?? 'all') === 'mentions')
    return isAddressed(message.body, user, [user])
  return true
}

// Title names the sender and channel; body is a single-line excerpt.
export function notificationText(message, max = 120) {
  const { firstName, lastName } = message.sender
  const text = message.body.replace(/\s+/g, ' ').trim()
  return {
    title: `${firstName} ${lastName} in #${message.channelName}`,
    body: text.length > max ? `${text.slice(0, max - 1)}…` : text
  }
}
