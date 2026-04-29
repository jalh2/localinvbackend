require('dotenv').config()
const UserModel = require('../models/userModel')
const { hashPassword } = require('../utils/encryption')

const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123'

const run = async () => {
  try {
    const existing = await UserModel.findOne('username', ADMIN_USERNAME)
    if (existing) {
      console.log(`Admin user '${ADMIN_USERNAME}' already exists (id: ${existing.id}). Skipping.`)
      process.exit(0)
    }
    const user = await UserModel.create({
      username: ADMIN_USERNAME,
      password: hashPassword(ADMIN_PASSWORD),
      role: 'admin',
      displayName: 'Administrator',
      isActive: true
    })
    console.log(`Created admin user '${user.username}' (id: ${user.id}).`)
    console.log(`Password: ${ADMIN_PASSWORD}  <-- change this after first login`)
    process.exit(0)
  } catch (e) {
    console.error('Seed admin failed:', e)
    process.exit(1)
  }
}

run()
