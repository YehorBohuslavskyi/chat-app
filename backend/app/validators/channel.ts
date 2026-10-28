import vine from '@vinejs/vine'

export const nameRule = () =>
  vine
    .string()
    .trim()
    .toLowerCase()
    .minLength(2)
    .maxLength(32)
    .regex(/^[a-z0-9][a-z0-9_-]*$/)

export const createChannelValidator = vine.create({
  name: nameRule(),
  type: vine.enum(['public', 'private']),
  description: vine.string().trim().maxLength(160).optional(),
})
export const joinChannelValidator = vine.create({
  name: nameRule(),
  type: vine.enum(['public', 'private']).optional(),
})
export const nicknameValidator = vine.create({ nickname: nameRule() })
export const commandValidator = vine.create({
  command: vine.string().trim().minLength(1).maxLength(200),
  channelId: vine.number().positive().withoutDecimals().optional(),
})
