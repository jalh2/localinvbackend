const ExpenseModel = require('../models/expenseModel')
const StoreModel = require('../models/storeModel')
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

const listExpenses = async (req, res) => {
  try {
    const filter = {
      userId: isAdmin(req) && req.query.userId ? req.query.userId : await effectiveOwnerId(req)
    }
    if (req.query.storeId) filter.storeId = req.query.storeId
    let items = await ExpenseModel.findAll(filter)
    const { fromISO, toISO } = buildDateRange(req.query)
    if (fromISO || toISO) items = items.filter(e => inRange(e.occurredAt, fromISO, toISO))
    res.json(items)
  } catch (e) {
    console.error('listExpenses error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const getExpense = async (req, res) => {
  try {
    const item = await ExpenseModel.findById(req.params.id)
    if (!item) return res.status(404).json({ message: 'Expense not found' })
    if (!isAdmin(req) && item.userId !== await effectiveOwnerId(req)) return res.status(403).json({ message: 'Forbidden' })
    res.json(item)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const createExpense = async (req, res) => {
  try {
    const { description, amount, currency, category, note, occurredAt } = req.body
    if (!description || !description.trim()) return res.status(400).json({ message: 'Description is required' })
    const amt = Number(amount)
    if (!isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'Invalid amount' })

    const cur = currency || 'LRD'
    if (!isCurrency(cur)) return res.status(400).json({ message: 'Invalid currency' })

    const effectiveId = await effectiveOwnerId(req)
    const stores = await StoreModel.findAll({ userId: effectiveId })
    const storeId = stores.length > 0 ? stores[0].id : ''

    const expense = await ExpenseModel.create({
      userId: effectiveId,
      storeId,
      description: description.trim(),
      amount: amt,
      currency: cur,
      category: category || '',
      note: note || '',
      occurredAt: occurredAt || null
    })

    res.status(201).json(expense)
  } catch (e) {
    console.error('createExpense error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const updateExpense = async (req, res) => {
  try {
    const existing = await ExpenseModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Expense not found' })
    if (!isAdmin(req) && existing.userId !== await effectiveOwnerId(req)) return res.status(403).json({ message: 'Forbidden' })

    const allowed = ['description', 'amount', 'currency', 'category', 'note', 'occurredAt']
    const data = {}
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key]
    if (data.currency && !isCurrency(data.currency)) return res.status(400).json({ message: 'Invalid currency' })

    const expense = await ExpenseModel.update(req.params.id, data)
    res.json(expense)
  } catch (e) {
    console.error('updateExpense error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const deleteExpense = async (req, res) => {
  try {
    const existing = await ExpenseModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Expense not found' })
    if (!isAdmin(req) && existing.userId !== await effectiveOwnerId(req)) return res.status(403).json({ message: 'Forbidden' })
    await ExpenseModel.remove(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { listExpenses, getExpense, createExpense, updateExpense, deleteExpense }
