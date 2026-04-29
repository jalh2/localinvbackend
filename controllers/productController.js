const ProductModel = require('../models/productModel')
const StoreModel = require('../models/storeModel')
const PurchaseModel = require('../models/purchaseModel')
const { isCurrency } = require('../utils/currency')

const isAdmin = (req) => req.session.user.role === 'admin'
const ownerId = (req) => req.session.user.id

const listProducts = async (req, res) => {
  try {
    const filter = {}
    if (req.query.storeId) filter.storeId = req.query.storeId
    filter.userId = isAdmin(req) && req.query.userId ? req.query.userId : ownerId(req)
    const products = await ProductModel.findAll(filter)
    res.json(products)
  } catch (e) {
    console.error('listProducts error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const getProduct = async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id)
    if (!product) return res.status(404).json({ message: 'Product not found' })
    if (!isAdmin(req) && product.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })
    res.json(product)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const createProduct = async (req, res) => {
  try {
    const {
      storeId, name, description, image,
      buyingPrice, buyingCurrency,
      sellingPrice, sellingCurrency,
      currentQuantity, lowStockThreshold,
      bulkQuantity, bulkTotalCost
    } = req.body

    if (!storeId) return res.status(400).json({ message: 'storeId is required' })
    if (!name) return res.status(400).json({ message: 'Name is required' })

    const store = await StoreModel.findById(storeId)
    if (!store) return res.status(404).json({ message: 'Store not found' })
    if (!isAdmin(req) && store.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })

    const buyCur = buyingCurrency || 'LRD'
    const sellCur = sellingCurrency || buyCur
    if (!isCurrency(buyCur) || !isCurrency(sellCur)) return res.status(400).json({ message: 'Invalid currency' })

    // Resolve buying price: either direct or computed from bulk purchase.
    let resolvedBuyingPrice = Number(buyingPrice)
    let bulkRecord = null
    if ((buyingPrice === undefined || buyingPrice === null || buyingPrice === '') && bulkQuantity && bulkTotalCost) {
      const bq = Number(bulkQuantity)
      const bt = Number(bulkTotalCost)
      if (!isFinite(bq) || bq <= 0 || !isFinite(bt) || bt <= 0) {
        return res.status(400).json({ message: 'Invalid bulk quantity/total cost' })
      }
      resolvedBuyingPrice = bt / bq
      bulkRecord = { bq, bt }
    }
    if (!isFinite(resolvedBuyingPrice) || resolvedBuyingPrice < 0) {
      return res.status(400).json({ message: 'Buying price is required (or provide bulkQuantity + bulkTotalCost)' })
    }

    const startQty = bulkRecord ? bulkRecord.bq : Number(currentQuantity || 0)
    if (!isFinite(startQty) || startQty < 0) return res.status(400).json({ message: 'Invalid quantity' })

    const product = await ProductModel.create({
      userId: store.userId,
      storeId,
      name,
      description: description || '',
      image: image || '',
      buyingPrice: resolvedBuyingPrice,
      buyingCurrency: buyCur,
      sellingPrice: Number(sellingPrice || 0),
      sellingCurrency: sellCur,
      currentQuantity: startQty,
      lowStockThreshold: Number(lowStockThreshold || 0)
    })

    if (bulkRecord) {
      await PurchaseModel.create({
        userId: store.userId,
        storeId,
        productId: product.id,
        quantity: bulkRecord.bq,
        unitCost: resolvedBuyingPrice,
        totalCost: bulkRecord.bt,
        currency: buyCur,
        note: 'Initial bulk purchase'
      })
    } else if (startQty > 0) {
      await PurchaseModel.create({
        userId: store.userId,
        storeId,
        productId: product.id,
        quantity: startQty,
        unitCost: resolvedBuyingPrice,
        totalCost: resolvedBuyingPrice * startQty,
        currency: buyCur,
        note: 'Initial stock'
      })
    }

    res.status(201).json(product)
  } catch (e) {
    console.error('createProduct error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const updateProduct = async (req, res) => {
  try {
    const existing = await ProductModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Product not found' })
    if (!isAdmin(req) && existing.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })

    const allowed = ['name', 'description', 'image', 'buyingPrice', 'buyingCurrency', 'sellingPrice', 'sellingCurrency', 'lowStockThreshold', 'currentQuantity']
    const data = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key]
    }
    if (data.buyingCurrency && !isCurrency(data.buyingCurrency)) return res.status(400).json({ message: 'Invalid buyingCurrency' })
    if (data.sellingCurrency && !isCurrency(data.sellingCurrency)) return res.status(400).json({ message: 'Invalid sellingCurrency' })

    const product = await ProductModel.update(req.params.id, data)
    res.json(product)
  } catch (e) {
    console.error('updateProduct error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const deleteProduct = async (req, res) => {
  try {
    const existing = await ProductModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Product not found' })
    if (!isAdmin(req) && existing.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })
    await ProductModel.remove(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct }
