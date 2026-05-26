const express = require('express')
const router = express.Router()
const { listPurchases, getPurchase, createPurchase, updatePurchase, deletePurchase } = require('../controllers/purchaseController')
const { requireAuth, requireNotEmployee } = require('../middleware/auth')

router.use(requireAuth)
router.get('/', listPurchases)
router.post('/', createPurchase)
router.get('/:id', getPurchase)
router.put('/:id', updatePurchase)
router.delete('/:id', requireNotEmployee, deletePurchase)

module.exports = router
