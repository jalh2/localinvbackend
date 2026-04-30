const StoreModel = require('../models/storeModel')

const isAdmin = (req) => req.session.user.role === 'admin'
const ownerId = (req) => req.session.user.id

const listStores = async (req, res) => {
  try {
    const filter = isAdmin(req) && req.query.userId
      ? { userId: req.query.userId }
      : { userId: ownerId(req) }
    const stores = await StoreModel.findAll(filter)
    res.json(stores)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const getStore = async (req, res) => {
  try {
    const store = await StoreModel.findById(req.params.id)
    if (!store) return res.status(404).json({ message: 'Store not found' })
    if (!isAdmin(req) && store.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })
    res.json(store)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const createStore = async (req, res) => {
  try {
    const { name, description, location } = req.body
    if (!name) return res.status(400).json({ message: 'Name is required' })
    const existingStores = await StoreModel.findAll({ userId: ownerId(req) })
    if (existingStores.length > 0) return res.status(400).json({ message: 'This user already has a store' })
    const store = await StoreModel.create({
      userId: ownerId(req),
      name,
      description: description || '',
      location: location || ''
    })
    res.status(201).json(store)
  } catch (e) {
    console.error('createStore error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

const updateStore = async (req, res) => {
  try {
    const existing = await StoreModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Store not found' })
    if (!isAdmin(req) && existing.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })

    const { name, description, location } = req.body
    const data = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (location !== undefined) data.location = location

    const store = await StoreModel.update(req.params.id, data)
    res.json(store)
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const deleteStore = async (req, res) => {
  try {
    const existing = await StoreModel.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Store not found' })
    if (!isAdmin(req) && existing.userId !== ownerId(req)) return res.status(403).json({ message: 'Forbidden' })
    await StoreModel.remove(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { listStores, getStore, createStore, updateStore, deleteStore }
