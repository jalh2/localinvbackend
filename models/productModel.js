const { db, admin } = require('../config')

const collection = db.collection('products')

const defaults = {
  userId: '',
  storeId: '',
  name: '',
  description: '',
  image: '',
  buyingPrice: 0,
  buyingCurrency: 'LRD',
  sellingPrice: 0,
  sellingCurrency: 'LRD',
  currentQuantity: 0,
  lowStockThreshold: 0,
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

const findAll = async ({ userId, storeId } = {}) => {
  let q = collection
  if (userId) q = q.where('userId', '==', userId)
  if (storeId) q = q.where('storeId', '==', storeId)
  const snapshot = await q.get()
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
}

const adjustQuantity = async (id, delta) => {
  await collection.doc(id).update({
    currentQuantity: admin.firestore.FieldValue.increment(delta),
    updatedAt: new Date().toISOString()
  })
  return findById(id)
}

module.exports = { collection, defaults, findById, create, update, remove, findAll, adjustQuantity }
