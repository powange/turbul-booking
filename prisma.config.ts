// Configuration Prisma 7 — depuis la v7, l'URL de la datasource ne peut plus
// être déclarée dans `schema.prisma`. Elle est lue ici pour le CLI (migrate,
// generate, studio, etc.). Côté runtime, le `PrismaClient` reçoit un adapter
// PG (cf. server/utils/db.ts).
//
// Doc : https://pris.ly/d/config-datasource
//
// `process.env.DATABASE_URL` est attendu en input — fourni par docker-compose,
// le shell, ou Prisma qui charge automatiquement le `.env` à côté du config.
// On ne fait pas appel à `dotenv` explicitement pour rester léger en prod
// (image runtime n'a pas la dépendance).
import { defineConfig, env } from 'prisma/config'

type Env = {
  DATABASE_URL: string
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: env<Env>('DATABASE_URL')
  }
})
