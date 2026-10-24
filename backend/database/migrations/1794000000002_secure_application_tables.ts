import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    if (this.db.dialect.name !== 'postgres') return
    // Adonis connects as the table owner. Block Supabase's public API roles.
    // https://supabase.com/docs/guides/database/secure-data
    for (const table of [
      'users',
      'auth_access_tokens',
      'channels',
      'channel_members',
      'channel_bans',
      'kick_votes',
    ]) {
      this.schema.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
      this.schema.raw(`REVOKE ALL ON TABLE ${table} FROM anon, authenticated`)
    }
  }

  async down() {
    // Deliberately retain protection when reverting application migrations.
  }
}
