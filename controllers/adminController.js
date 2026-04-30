const UserModel = require('../models/userModel')
const StoreModel = require('../models/storeModel')
const ProductModel = require('../models/productModel')
const PurchaseModel = require('../models/purchaseModel')
const SaleModel = require('../models/saleModel')
const { hashPassword } = require('../utils/encryption')
const { isCurrency } = require('../utils/currency')
const { sanitize } = require('./userController')

const listUsers = async (req, res) => {
  try {
    const users = await UserModel.findAll()
    res.json(users.map(sanitize))
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const getUser = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    const [stores, products] = await Promise.all([
      StoreModel.findAll({ userId: user.id }),
      ProductModel.findAll({ userId: user.id })
    ])
    res.json({ ...sanitize(user), stores, productCount: products.length })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const updateUser = async (req, res) => {
  try {
    const { isActive, role, displayName, phone, password, baseCurrency, exchangeRateUsdToLrd } = req.body
    const data = {}
    if (isActive !== undefined) data.isActive = isActive
    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) return res.status(400).json({ message: 'Invalid role' })
      data.role = role
    }
    if (displayName !== undefined) data.displayName = displayName
    if (phone !== undefined) data.phone = phone
    if (password) data.password = hashPassword(password)
    if (baseCurrency !== undefined) {
      if (!isCurrency(baseCurrency)) return res.status(400).json({ message: 'Invalid currency' })
      data.baseCurrency = baseCurrency
    }
    if (exchangeRateUsdToLrd !== undefined) {
      const rate = Number(exchangeRateUsdToLrd)
      if (!isFinite(rate) || rate <= 0) return res.status(400).json({ message: 'Invalid exchange rate' })
      data.exchangeRateUsdToLrd = rate
    }
    const user = await UserModel.update(req.params.id, data)
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(sanitize(user))
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const upsertUserStore = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (user.role !== 'user') return res.status(400).json({ message: 'Only regular users can have stores' })

    const { name, description, location } = req.body
    if (!name || !name.trim()) return res.status(400).json({ message: 'Store name is required' })

    const stores = await StoreModel.findAll({ userId: user.id })
    if (stores.length > 0) {
      const store = await StoreModel.update(stores[0].id, {
        name: name.trim(),
        description: description || '',
        location: location || ''
      })
      return res.json(store)
    }

    const store = await StoreModel.create({
      userId: user.id,
      name: name.trim(),
      description: description || '',
      location: location || ''
    })
    res.status(201).json(store)
  } catch (e) {
    console.error('upsertUserStore error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const platformOverview = async (req, res) => {
  try {
    const [users, stores, products, purchases, sales] = await Promise.all([
      UserModel.findAll(),
      StoreModel.findAll(),
      ProductModel.findAll(),
      PurchaseModel.findAll(),
      SaleModel.findAll()
    ])
    res.json({
      userCount: users.length,
      activeUserCount: users.filter(u => u.isActive).length,
      storeCount: stores.length,
      productCount: products.length,
      purchaseCount: purchases.length,
      saleCount: sales.length
    })
  } catch (e) {
    console.error('platformOverview error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { listUsers, getUser, updateUser, upsertUserStore, platformOverview }
