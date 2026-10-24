import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('channels', (table) => {
      table.increments('id')
      table.string('name', 32).notNullable().unique()
      table.string('description', 160).notNullable().defaultTo('')
      table.enum('type', ['public', 'private']).notNullable()
      table.integer('admin_id').unsigned().notNullable().references('id').inTable('users')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('last_message_at', { useTz: true }).notNullable().index()
    })
    this.schema.createTable('channel_members', (table) => {
      table
        .integer('channel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('channels')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.timestamp('joined_at', { useTz: true }).notNullable()
      table.timestamp('invited_at', { useTz: true }).nullable()
      table.boolean('invitation_seen').notNullable().defaultTo(true)
      table.primary(['channel_id', 'user_id'])
      table.index(['user_id', 'channel_id'])
    })
    this.schema.createTable('channel_bans', (table) => {
      table
        .integer('channel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('channels')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.enum('reason', ['admin', 'votes']).notNullable()
      table.timestamp('banned_at', { useTz: true }).notNullable()
      table.primary(['channel_id', 'user_id'])
    })
    this.schema.createTable('kick_votes', (table) => {
      table
        .integer('channel_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('channels')
        .onDelete('CASCADE')
      table
        .integer('target_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('voter_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.primary(['channel_id', 'target_id', 'voter_id'])
    })
  }

  async down() {
    this.schema.dropTable('kick_votes')
    this.schema.dropTable('channel_bans')
    this.schema.dropTable('channel_members')
    this.schema.dropTable('channels')
  }
}
