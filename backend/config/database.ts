import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'
import env from '#start/env'
import { readFileSync } from 'node:fs'

const dbConfig = defineConfig({
  // Automated tests always use a separate local database, never the hosted project.
  connection: app.inTest ? 'sqlite' : env.get('DB_CONNECTION', 'sqlite'),

  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
        // https://supabase.com/docs/guides/database/connecting-to-postgres
        ssl: env.get('DB_SSL', true)
          ? {
              rejectUnauthorized: true,
              ...(env.get('DB_SSL_CA_PATH')
                ? { ca: readFileSync(env.get('DB_SSL_CA_PATH')!, 'utf8') }
                : {}),
            }
          : false,
      },
      pool: { min: 0, max: 5 },
      migrations: { naturalSort: true, paths: ['database/migrations'] },
      schemaGeneration: { enabled: false },
    },
    sqlite: {
      client: 'better-sqlite3',

      connection: {
        filename: app.tmpPath(app.inTest ? 'test.sqlite3' : 'db.sqlite3'),
      },

      useNullAsDefault: true,

      migrations: {
        naturalSort: true,

        paths: ['database/migrations'],
      },

      schemaGeneration: {
        enabled: false,

        rulesPaths: ['./database/schema_rules.js'],
      },
    },
  },
})

export default dbConfig
