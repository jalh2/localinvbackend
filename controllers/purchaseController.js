const PurchaseModel = require('../models/purchaseModel')
const ProductModel = require('../models/productModel')
const { isCurrency } = require('../utils/currency')
const { buildDateRange, inRange } = require('../utils/dateRange')

const isAdmin = (req) => req.session.user.role === 'admin'
const ownerId = (req) => req.session.user.id

const listPurchases = async (req, res) => {
  try {
    const filter = {
      userId: isAdmin(req) && req.query.userId ? req.query.userId : ownerId(req)
    }
    if (req.query.storeId) filter.storeId = req.query.storeId
    if (req.query.productId) filter.productId = req.query.productId
    let items = await PurchaseModel.findAll(filter)
    const { fromISO, toISO } = buildDateRange(req.query)
    if (fromISO || toISO) items = items.filter(p => inRange(p.occurredAt, fromISO, toISO))
    res.json(items)
  } catch (e) {
    console.error('listPurchases error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const getPurchase = async (req, res) => {
  try {
    const item = await PurchaseModel.findById(req.params.id)
    if (!item) return res.status(404).json({ message: 'Purchase not found' })
    if (!isAdmin(req) && item.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })
    res.json(item)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const createPurchase = async (req, res) => {
  try {
    const { productId, quantity, unitCost, totalCost, currency, note, occurredAt, updateBuyingPrice } = req.body
    if (!productId) return res.status(400).json({ message: 'productId is required' })
    const qty = Number(quantity)
    if (!isFinite(qty) || qty <= 0) return res.status(400).json({ message: 'Invalid quantity' })

    const product = await ProductModel.findById(productId)
    if (!product) return res.status(404).json({ message: 'Product not found' })
    if (!isAdmin(req) && product.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })

    const cur = currency || product.buyingCurrency || 'LRD'
    if (!isCurrency(cur)) return res.status(400).json({ message: 'Invalid currency' })

    let unit = Number(unitCost)
    let total = Number(totalCost)
    if (!isFinite(unit) || unit < 0) {
      if (isFinite(total) && total >= 0) unit = total / qty
      else return res.status(400).json({ message: 'unitCost or totalCost is required' })
    }
    if (!isFinite(total) || total < 0) total = unit * qty

    const purchase = await PurchaseModel.create({
      userId: product.userId,
      storeId: product.storeId,
      productId,
      quantity: qty,
      unitCost: unit,
      totalCost: total,
      currency: cur,
      note: note || '',
      occurredAt: occurredAt || null
    })

    const updates = {}
    if (updateBuyingPrice) {
      updates.buyingPrice = unit
      updates.buyingCurrency = cur
    }
    if (Object.keys(updates).length) await ProductModel.update(productId, updates)
    await ProductModel.adjustQuantity(productId, qty)

    res.status(201).json(purchase)
  } catch (e) {
    console.error('createPurchase error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const updatePurchase = async (req, res) => {
  try {
    const existing = await PurchaseModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Purchase not found' })
    if (!isAdmin(req) && existing.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })

    const allowed = ['quantity', 'unitCost', 'totalCost', 'currency', 'note', 'occurredAt']
    const data = {}
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key]
    if (data.currency && !isCurrency(data.currency)) return res.status(400).json({ message: 'Invalid currency' })

    // Adjust product quantity by delta if quantity changed
    if (data.quantity !== undefined) {
      const newQty = Number(data.quantity)
      if (!isFinite(newQty) || newQty < 0) return res.status(400).json({ message: 'Invalid quantity' })
      const delta = newQty - existing.quantity
      if (delta !== 0) await ProductModel.adjustQuantity(existing.productId, delta)
      data.quantity = newQty
    }
    if (data.unitCost !== undefined && data.totalCost === undefined) {
      data.totalCost = Number(data.unitCost) * (data.quantity !== undefined ? data.quantity : existing.quantity)
    }

    const purchase = await PurchaseModel.update(req.params.id, data)
    res.json(purchase)
  } catch (e) {
    console.error('updatePurchase error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const deletePurchase = async (req, res) => {
  try {
    const existing = await PurchaseModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Purchase not found' })
    if (!isAdmin(req) && existing.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })
    await ProductModel.adjustQuantity(existing.productId, -existing.quantity)
    await PurchaseModel.remove(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { listPurchases, getPurchase, createPurchase, updatePurchase, deletePurchase }
