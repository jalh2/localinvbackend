const SaleModel = require('../models/saleModel')
const ProductModel = require('../models/productModel')
const UserModel = require('../models/userModel')
const { isCurrency } = require('../utils/currency')
const { buildDateRange, inRange } = require('../utils/dateRange')

const isAdmin = (req) => req.session.user.role === 'admin'
const ownerId = (req) => req.session.user.id

const effectiveOwnerId = async (req) => {
  if (isAdmin(req)) return null
  const user = await UserModel.findById(ownerId(req))
  if (user && user.storeRole === 'employee' && user.ownerUserId) return user.ownerUserId
  return ownerId(req)
}

const listSales = async (req, res) => {
  try {
    const filter = {
      userId: isAdmin(req) && req.query.userId ? req.query.userId : await effectiveOwnerId(req)
    }
    if (req.query.storeId) filter.storeId = req.query.storeId
    if (req.query.productId) filter.productId = req.query.productId
    let items = await SaleModel.findAll(filter)
    const { fromISO, toISO } = buildDateRange(req.query)
    if (fromISO || toISO) items = items.filter(s => inRange(s.occurredAt, fromISO, toISO))
    res.json(items)
  } catch (e) {
    console.error('listSales error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const getSale = async (req, res) => {
  try {
    const item = await SaleModel.findById(req.params.id)
    if (!item) return res.status(404).json({ message: 'Sale not found' })
    if (!isAdmin(req) && item.userId !== await effectiveOwnerId(req)) return res.status(403).json({ message: 'Forbidden' })
    res.json(item)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const createSale = async (req, res) => {
  try {
    const { productId, quantity, unitSellingPrice, sellingCurrency, note, occurredAt } = req.body
    if (!productId) return res.status(400).json({ message: 'productId is required' })
    const qty = Number(quantity)
    if (!isFinite(qty) || qty <= 0) return res.status(400).json({ message: 'Invalid quantity' })

    const product = await ProductModel.findById(productId)
    if (!product) return res.status(404).json({ message: 'Product not found' })
    if (!isAdmin(req) && product.userId !== await effectiveOwnerId(req)) return res.status(403).json({ message: 'Forbidden' })

    if ((product.currentQuantity || 0) < qty) {
      return res.status(400).json({ message: `Not enough stock (available: ${product.currentQuantity || 0})` })
    }

    const sellPrice = unitSellingPrice !== undefined ? Number(unitSellingPrice) : Number(product.sellingPrice)
    if (!isFinite(sellPrice) || sellPrice < 0) return res.status(400).json({ message: 'Invalid selling price' })

    const sellCur = sellingCurrency || product.sellingCurrency || 'LRD'
    if (!isCurrency(sellCur)) return res.status(400).json({ message: 'Invalid sellingCurrency' })

    const sale = await SaleModel.create({
      userId: product.userId,
      storeId: product.storeId,
      productId,
      quantity: qty,
      unitSellingPrice: sellPrice,
      sellingCurrency: sellCur,
      unitBuyingPrice: Number(product.buyingPrice || 0),
      buyingCurrency: product.buyingCurrency || 'LRD',
      note: note || '',
      occurredAt: occurredAt || null
    })

    await ProductModel.adjustQuantity(productId, -qty)
    res.status(201).json(sale)
  } catch (e) {
    console.error('createSale error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const updateSale = async (req, res) => {
  try {
    const existing = await SaleModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Sale not found' })
    if (!isAdmin(req) && existing.userId !== await effectiveOwnerId(req)) return res.status(403).json({ message: 'Forbidden' })

    const allowed = ['quantity', 'unitSellingPrice', 'sellingCurrency', 'unitBuyingPrice', 'buyingCurrency', 'note', 'occurredAt']
    const data = {}
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key]
    if (data.sellingCurrency && !isCurrency(data.sellingCurrency)) return res.status(400).json({ message: 'Invalid sellingCurrency' })
    if (data.buyingCurrency && !isCurrency(data.buyingCurrency)) return res.status(400).json({ message: 'Invalid buyingCurrency' })

    if (data.quantity !== undefined) {
      const newQty = Number(data.quantity)
      if (!isFinite(newQty) || newQty <= 0) return res.status(400).json({ message: 'Invalid quantity' })
      const delta = existing.quantity - newQty // sales reduce stock; reversing delta restores stock
      if (delta !== 0) await ProductModel.adjustQuantity(existing.productId, delta)
      data.quantity = newQty
    }

    const sale = await SaleModel.update(req.params.id, data)
    res.json(sale)
  } catch (e) {
    console.error('updateSale error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const deleteSale = async (req, res) => {
  try {
    const existing = await SaleModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Sale not found' })
    if (!isAdmin(req) && existing.userId !== await effectiveOwnerId(req)) return res.status(403).json({ message: 'Forbidden' })
    await ProductModel.adjustQuantity(existing.productId, existing.quantity) // restore stock
    await SaleModel.remove(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { listSales, getSale, createSale, updateSale, deleteSale }
