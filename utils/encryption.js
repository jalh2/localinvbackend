const crypto = require('crypto')

const hashPassword = password => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

const comparePassword = (password, storedPassword) => {
  const [salt, originalHash] = storedPassword.split(':')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return hash === originalHash
}

module.exports = { hashPassword, comparePassword }
