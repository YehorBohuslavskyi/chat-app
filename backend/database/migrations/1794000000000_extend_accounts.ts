import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.string('first_name', 100).notNullable().defaultTo('')
      table.string('last_name', 100).notNullable().defaultTo('')
      table.string('nickname', 32).nullable().unique()
    })
    this.defer(async (db) => {
      // Preserve existing starter accounts; they have no structured names yet.
      const users = await db.from('users').select('id', 'full_name')
      for (const user of users) {
        await db
          .from('users')
          .where('id', user.id)
          .update({
            first_name: (user.full_name || '').slice(0, 100),
            nickname: `legacy-${user.id}`,
          })
      }
    })
    this.schema.alterTable('users', (table) => {
      table.string('nickname', 32).notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropColumn('nickname')
      table.dropColumn('first_name')
      table.dropColumn('last_name')
    })
  }
}
