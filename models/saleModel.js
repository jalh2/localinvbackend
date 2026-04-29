const { db } = require('../config')

const collection = db.collection('sales')

const defaults = {
  userId: '',
  storeId: '',
  productId: '',
  quantity: 0,
  unitSellingPrice: 0,
  sellingCurrency: 'LRD',
  unitBuyingPrice: 0,
  buyingCurrency: 'LRD',
  note: '',
  occurredAt: null,
  createdAt: null,
  updatedAt: null
}

const findById = async (id) => {
  const doc = await collection.doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() }
}

const create = async (data) => {
  const now = new Date().toISOString()
  const docData = { ...defaults, ...data, createdAt: now, updatedAt: now }
  if (!docData.occurredAt) docData.occurredAt = now
  const ref = await collection.add(docData)
  return { id: ref.id, ...docData }
}

const update = async (id, data) => {
  const now = new Date().toISOString()
  await collection.doc(id).update({ ...data, updatedAt: now })
  return findById(id)
}

const remove = async (id) => {
  await collection.doc(id).delete()
  return { success: true }
}

const findAll = async ({ userId, storeId, productId } = {}) => {
  let q = collection
  if (userId) q = q.where('userId', '==', userId)
  if (storeId) q = q.where('storeId', '==', storeId)
  if (productId) q = q.where('productId', '==', productId)
  const snapshot = await q.get()
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.occurredAt || '').localeCompare(a.occurredAt || ''))
}

module.exports = { collection, defaults, findById, create, update, remove, findAll }
