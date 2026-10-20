import { isAddressed } from '../chat/utils/mentions.js'

export function shouldNotify({ message, user, visible }) {
  if (!user || visible || user.status === 'offline') return false
  if (user.status === 'dnd') return false
  if (message.senderId === user.id) return false

  if ((user.notifications ?? 'all') === 'mentions')
    return isAddressed(message.body, user, [user])
  return true
}

export function notificationText(message, max = 120) {
  const { firstName, lastName } = message.sender
  const text = message.body.replace(/\s+/g, ' ').trim()
  return {
    title: `${firstName} ${lastName} in #${message.channelName}`,
    body: text.length > max ? `${text.slice(0, max - 1)}…` : text
  }
}
