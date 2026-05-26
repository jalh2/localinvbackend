const express = require('express')
const router = express.Router()
const { listStores, getStore, createStore, updateStore, deleteStore } = require('../controllers/storeController')
const { requireAuth, requireNotEmployee } = require('../middleware/auth')

router.use(requireAuth)
router.get('/', listStores)
router.post('/', createStore)
router.get('/:id', getStore)
router.put('/:id', updateStore)
router.delete('/:id', requireNotEmployee, deleteStore)

module.exports = router
