const { db } = require('../config')

const collection = db.collection('stores')

const defaults = {
  userId: '',
  name: '',
  description: '',
  location: '',
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

const findAll = async ({ userId } = {}) => {
  let q = collection
  if (userId) q = q.where('userId', '==', userId)
  const snapshot = await q.get()
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
}

module.exports = { collection, defaults, findById, create, update, remove, findAll }
