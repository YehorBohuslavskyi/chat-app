const syntax = {
  join: { min: 1, max: 2, usage: '/join channel-name [private]' },
  invite: { min: 1, max: 1, usage: '/invite nickname' },
  kick: { min: 1, max: 1, usage: '/kick nickname' },
  revoke: { min: 1, max: 1, usage: '/revoke nickname' },
  list: { min: 0, max: 0, usage: '/list' },
  cancel: { min: 0, max: 0, usage: '/cancel' },
  quit: { min: 0, max: 0, usage: '/quit' },
  help: { min: 0, max: 0, usage: '/help' }
}
export const commandHelp = Object.values(syntax).map(item => item.usage)

export function parseCommand(text) {
  const value = text.trim()
  if (!value.startsWith('/')) return { type: 'message', body: value }
  const [name, ...args] = value.slice(1).split(/\s+/)
  const command = syntax[name]
  if (!command)
    throw new Error('Unknown command. Use /help to see available commands.')
  if (
    args.length < command.min ||
    args.length > command.max ||
    (name === 'join' && args[1] && args[1] !== 'private')
  )
    throw new Error(`Usage: ${command.usage}`)
  return { type: 'command', name, args }
}
