const { db } = require('../config')

const collection = db.collection('users')

const defaults = {
  username: '',
  password: '',
  role: 'user',
  displayName: '',
  phone: '',
  isActive: true,
  exchangeRateUsdToLrd: 180,
  baseCurrency: 'LRD',
  createdAt: null,
  updatedAt: null
}

const findOne = async (field, value) => {
  const snapshot = await collection.where(field, '==', value).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() }
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

const findAll = async () => {
  const snapshot = await collection.orderBy('createdAt', 'desc').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

module.exports = { collection, defaults, findOne, findById, create, update, remove, findAll }
