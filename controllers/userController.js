const UserModel = require('../models/userModel')
const StoreModel = require('../models/storeModel')
const { hashPassword, comparePassword } = require('../utils/encryption')
const { isCurrency } = require('../utils/currency')

const sanitize = (user) => {
  if (!user) return user
  const { password, ...safe } = user
  return safe
}

const register = async (req, res) => {
  try {
    const { username, password, displayName, phone, storeName, storeLocation, storeDescription } = req.body
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' })
    if (!storeName || !storeName.trim()) return res.status(400).json({ message: 'Store name is required' })

    const existing = await UserModel.findOne('username', username)
    if (existing) return res.status(400).json({ message: 'Username already exists' })

    const user = await UserModel.create({
      username,
      password: hashPassword(password),
      role: 'user',
      displayName: displayName || username,
      phone: phone || '',
      isActive: true
    })

    await StoreModel.create({
      userId: user.id,
      name: storeName.trim(),
      location: storeLocation || '',
      description: storeDescription || ''
    })

    req.session.user = { id: user.id, username: user.username, role: user.role }
    res.status(201).json(sanitize(user))
  } catch (e) {
    console.error('register error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const login = async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' })

    const user = await UserModel.findOne('username', username)
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid credentials' })

    const valid = comparePassword(password, user.password)
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' })

    req.session.user = { id: user.id, username: user.username, role: user.role }
    res.json(sanitize(user))
  } catch (e) {
    console.error('login error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const logout = async (req, res) => {
  try {
    req.session.destroy(() => res.json({ success: true }))
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const getMe = async (req, res) => {
  try {
    const user = await UserModel.findById(req.session.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(sanitize(user))
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const updateMe = async (req, res) => {
  try {
    const { displayName, phone, password, baseCurrency } = req.body
    const data = {}
    if (displayName !== undefined) data.displayName = displayName
    if (phone !== undefined) data.phone = phone
    if (password) data.password = hashPassword(password)
    if (baseCurrency !== undefined) {
      if (!isCurrency(baseCurrency)) return res.status(400).json({ message: 'Invalid currency' })
      data.baseCurrency = baseCurrency
    }
    const user = await UserModel.update(req.session.user.id, data)
    res.json(sanitize(user))
  } catch (e) {
    console.error('updateMe error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { register, login, logout, getMe, updateMe, sanitize }
