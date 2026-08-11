const UserModel = require('../models/userModel')
const StoreModel = require('../models/storeModel')
const ProductModel = require('../models/productModel')
const PurchaseModel = require('../models/purchaseModel')
const SaleModel = require('../models/saleModel')
const { hashPassword } = require('../utils/encryption')
const { isCurrency, convert } = require('../utils/currency')
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
    const effectiveUserId = (user.storeRole === 'employee' && user.ownerUserId) ? user.ownerUserId : user.id
    const [stores, products, allUsers] = await Promise.all([
      StoreModel.findAll({ userId: effectiveUserId }),
      ProductModel.findAll({ userId: effectiveUserId }),
      user.storeRole === 'owner' ? UserModel.findAll() : Promise.resolve([])
    ])
    const employees = allUsers.filter(u => u.storeRole === 'employee' && u.ownerUserId === user.id)
    res.json({ ...sanitize(user), stores, productCount: products.length, employees: employees.map(sanitize) })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const updateUser = async (req, res) => {
  try {
    const { isActive, role, storeRole, ownerUserId, displayName, phone, password, baseCurrency, exchangeRateUsdToLrd } = req.body
    const data = {}
    if (isActive !== undefined) data.isActive = isActive
    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) return res.status(400).json({ message: 'Invalid role' })
      data.role = role
    }
    if (storeRole !== undefined) {
      if (!['owner', 'employee'].includes(storeRole)) return res.status(400).json({ message: 'Invalid storeRole' })
      data.storeRole = storeRole
    }
    if (ownerUserId !== undefined) data.ownerUserId = ownerUserId || null
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
    if (user.role !== 'user' || user.storeRole === 'employee') return res.status(400).json({ message: 'Only store owners can have stores' })

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
    const userMap = new Map(users.map(u => [u.id, u]))
    const round2 = n => Math.round(n * 100) / 100

    let inventoryExpectedProfit = 0
    for (const p of products) {
      const owner = userMap.get(p.userId)
      const rate = (owner && Number(owner.exchangeRateUsdToLrd)) || 1
      const cost = convert((p.buyingPrice || 0) * (p.currentQuantity || 0), p.buyingCurrency || 'LRD', 'LRD', rate)
      const retail = convert((p.sellingPrice || 0) * (p.currentQuantity || 0), p.sellingCurrency || 'LRD', 'LRD', rate)
      inventoryExpectedProfit += retail - cost
    }

    const pendingSales = sales.filter(s => s.paymentType === 'credit' && s.paymentStatus !== 'paid')
    let pendingRevenue = 0
    let pendingProfit = 0
    for (const s of pendingSales) {
      const owner = userMap.get(s.userId)
      const rate = (owner && Number(owner.exchangeRateUsdToLrd)) || 1
      const revenue = convert((s.unitSellingPrice || 0) * (s.quantity || 0), s.sellingCurrency || 'LRD', 'LRD', rate)
      const cogs = convert((s.unitBuyingPrice || 0) * (s.quantity || 0), s.buyingCurrency || 'LRD', 'LRD', rate)
      pendingRevenue += revenue
      pendingProfit += revenue - cogs
    }

    res.json({
      userCount: users.length,
      activeUserCount: users.filter(u => u.isActive).length,
      storeCount: stores.length,
      productCount: products.length,
      purchaseCount: purchases.length,
      saleCount: sales.length,
      inventoryExpectedProfit: round2(inventoryExpectedProfit),
      pendingRevenue: round2(pendingRevenue),
      pendingProfit: round2(pendingProfit),
      pendingCreditCount: pendingSales.length
    })
  } catch (e) {
    console.error('platformOverview error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { listUsers, getUser, updateUser, upsertUserStore, platformOverview }
