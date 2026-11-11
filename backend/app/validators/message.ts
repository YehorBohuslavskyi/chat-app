import vine from '@vinejs/vine'

// logical_model.md rule 8: 1–4000 characters after trimming.
export const sendMessageValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(4000),
})

export const historyValidator = vine.create({
  before: vine.number().positive().withoutDecimals().optional(),
  after: vine.number().min(0).withoutDecimals().optional(),
  limit: vine.number().min(1).max(50).withoutDecimals().optional(),
})
