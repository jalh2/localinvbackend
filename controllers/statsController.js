const UserModel = require('../models/userModel')
const ProductModel = require('../models/productModel')
const PurchaseModel = require('../models/purchaseModel')
const SaleModel = require('../models/saleModel')
const { convert, isCurrency } = require('../utils/currency')
const { buildDateRange, inRange, bucketKey } = require('../utils/dateRange')

const isAdmin = (req) => req.session.user.role === 'admin'
const round2 = n => Math.round(n * 100) / 100

const resolveContext = async (req) => {
  const targetUserId = isAdmin(req) && req.query.userId ? req.query.userId : req.session.user.id
  const user = await UserModel.findById(targetUserId)
  if (!user) return null
  const display = req.query.currency && isCurrency(req.query.currency) ? req.query.currency : user.baseCurrency || 'LRD'
  return { userId: targetUserId, rate: user.exchangeRateUsdToLrd || 1, displayCurrency: display }
}

const filterByStoreAndDate = (items, storeId, fromISO, toISO) => {
  return items.filter(it => {
    if (storeId && it.storeId !== storeId) return false
    if ((fromISO || toISO) && !inRange(it.occurredAt, fromISO, toISO)) return false
    return true
  })
}

const overview = async (req, res) => {
  try {
    const ctx = await resolveContext(req)
    if (!ctx) return res.status(404).json({ message: 'User not found' })
    const { fromISO, toISO } = buildDateRange(req.query)
    const storeId = req.query.storeId

    const [products, purchases, sales] = await Promise.all([
      ProductModel.findAll({ userId: ctx.userId, ...(storeId ? { storeId } : {}) }),
      PurchaseModel.findAll({ userId: ctx.userId, ...(storeId ? { storeId } : {}) }),
      SaleModel.findAll({ userId: ctx.userId, ...(storeId ? { storeId } : {}) })
    ])

    const purchasesInRange = filterByStoreAndDate(purchases, storeId, fromISO, toISO)
    const salesInRange = filterByStoreAndDate(sales, storeId, fromISO, toISO)

    let inventoryUnits = 0
    let inventoryCostValue = 0
    let inventoryRetailValue = 0
    for (const p of products) {
      const qty = p.currentQuantity || 0
      inventoryUnits += qty
      inventoryCostValue += convert((p.buyingPrice || 0) * qty, p.buyingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)
      inventoryRetailValue += convert((p.sellingPrice || 0) * qty, p.sellingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)
    }

    let totalSpent = 0
    for (const pu of purchasesInRange) {
      totalSpent += convert(pu.totalCost || 0, pu.currency || 'LRD', ctx.displayCurrency, ctx.rate)
    }

    let totalRevenue = 0
    let totalCogs = 0
    let totalUnitsSold = 0
    for (const s of salesInRange) {
      totalUnitsSold += s.quantity || 0
      totalRevenue += convert((s.unitSellingPrice || 0) * (s.quantity || 0), s.sellingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)
      totalCogs += convert((s.unitBuyingPrice || 0) * (s.quantity || 0), s.buyingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)
    }
    const totalProfit = totalRevenue - totalCogs

    res.json({
      currency: ctx.displayCurrency,
      exchangeRateUsdToLrd: ctx.rate,
      inventoryUnits,
      inventoryCostValue: round2(inventoryCostValue),
      inventoryRetailValue: round2(inventoryRetailValue),
      totalSpent: round2(totalSpent),
      totalRevenue: round2(totalRevenue),
      totalCogs: round2(totalCogs),
      totalProfit: round2(totalProfit),
      totalUnitsSold,
      productCount: products.length
    })
  } catch (e) {
    console.error('stats overview error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const timeseries = async (req, res) => {
  try {
    const ctx = await resolveContext(req)
    if (!ctx) return res.status(404).json({ message: 'User not found' })
    const bucket = ['day', 'month', 'year'].includes(req.query.bucket) ? req.query.bucket : 'month'
    const { fromISO, toISO } = buildDateRange(req.query)
    const storeId = req.query.storeId

    const [purchases, sales] = await Promise.all([
      PurchaseModel.findAll({ userId: ctx.userId, ...(storeId ? { storeId } : {}) }),
      SaleModel.findAll({ userId: ctx.userId, ...(storeId ? { storeId } : {}) })
    ])

    const purchasesInRange = filterByStoreAndDate(purchases, storeId, fromISO, toISO)
    const salesInRange = filterByStoreAndDate(sales, storeId, fromISO, toISO)

    const buckets = {}
    const ensure = key => {
      if (!buckets[key]) buckets[key] = { key, spent: 0, revenue: 0, cogs: 0, profit: 0, unitsSold: 0 }
      return buckets[key]
    }

    for (const pu of purchasesInRange) {
      const k = bucketKey(pu.occurredAt, bucket)
      const b = ensure(k)
      b.spent += convert(pu.totalCost || 0, pu.currency || 'LRD', ctx.displayCurrency, ctx.rate)
    }
    for (const s of salesInRange) {
      const k = bucketKey(s.occurredAt, bucket)
      const b = ensure(k)
      const rev = convert((s.unitSellingPrice || 0) * (s.quantity || 0), s.sellingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)
      const cogs = convert((s.unitBuyingPrice || 0) * (s.quantity || 0), s.buyingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)
      b.revenue += rev
      b.cogs += cogs
      b.profit += rev - cogs
      b.unitsSold += s.quantity || 0
    }

    const series = Object.values(buckets)
      .map(b => ({
        key: b.key,
        spent: round2(b.spent),
        revenue: round2(b.revenue),
        cogs: round2(b.cogs),
        profit: round2(b.profit),
        unitsSold: b.unitsSold
      }))
      .sort((a, b) => a.key.localeCompare(b.key))

    res.json({ currency: ctx.displayCurrency, bucket, series })
  } catch (e) {
    console.error('stats timeseries error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const byProduct = async (req, res) => {
  try {
    const ctx = await resolveContext(req)
    if (!ctx) return res.status(404).json({ message: 'User not found' })
    const { fromISO, toISO } = buildDateRange(req.query)
    const storeId = req.query.storeId

    const [products, sales] = await Promise.all([
      ProductModel.findAll({ userId: ctx.userId, ...(storeId ? { storeId } : {}) }),
      SaleModel.findAll({ userId: ctx.userId, ...(storeId ? { storeId } : {}) })
    ])

    const salesInRange = filterByStoreAndDate(sales, storeId, fromISO, toISO)
    const byId = {}
    for (const p of products) {
      byId[p.id] = {
        productId: p.id,
        name: p.name,
        storeId: p.storeId,
        currentQuantity: p.currentQuantity || 0,
        onHandCostValue: round2(convert((p.buyingPrice || 0) * (p.currentQuantity || 0), p.buyingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)),
        onHandRetailValue: round2(convert((p.sellingPrice || 0) * (p.currentQuantity || 0), p.sellingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)),
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
        profit: 0
      }
    }
    for (const s of salesInRange) {
      const row = byId[s.productId]
      if (!row) continue
      const rev = convert((s.unitSellingPrice || 0) * (s.quantity || 0), s.sellingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)
      const cogs = convert((s.unitBuyingPrice || 0) * (s.quantity || 0), s.buyingCurrency || 'LRD', ctx.displayCurrency, ctx.rate)
      row.unitsSold += s.quantity || 0
      row.revenue += rev
      row.cogs += cogs
      row.profit += rev - cogs
    }

    const rows = Object.values(byId).map(r => ({
      ...r,
      revenue: round2(r.revenue),
      cogs: round2(r.cogs),
      profit: round2(r.profit)
    }))

    res.json({ currency: ctx.displayCurrency, products: rows })
  } catch (e) {
    console.error('stats byProduct error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { overview, timeseries, byProduct }
