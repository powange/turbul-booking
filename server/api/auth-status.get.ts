import { prisma } from '~~/server/utils/db'

// Indique au front si l'inscription publique est encore ouverte
// (uniquement pour le tout premier compte, qui devient ADMIN).
export default defineEventHandler(async () => {
  const userCount = await prisma.user.count()
  return {
    signupOpen: userCount === 0,
    userCount
  }
})
