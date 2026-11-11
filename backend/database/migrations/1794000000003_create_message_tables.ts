import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('messages', (table) => {
      // Increasing id doubles as the history cursor (see data_model/logical_model.md).
      table.increments('id')
      table
        .integer('channel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('channels')
        .onDelete('CASCADE')
      table
        .integer('sender_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.text('body').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      // History: newest messages of one channel, paged by id.
      table.index(['channel_id', 'id'])
    })
    this.schema.createTable('message_mentions', (table) => {
      table
        .integer('message_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('messages')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.primary(['message_id', 'user_id'])
      table.index(['user_id'])
    })

    if (this.db.dialect.name === 'postgres') {
      // Same protection as 1794000000002: block Supabase's public API roles.
      for (const table of ['messages', 'message_mentions']) {
        this.schema.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
        this.schema.raw(`REVOKE ALL ON TABLE ${table} FROM anon, authenticated`)
      }
    }
  }

  async down() {
    this.schema.dropTable('message_mentions')
    this.schema.dropTable('messages')
  }
}
