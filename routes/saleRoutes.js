const express = require('express')
const router = express.Router()
const { listSales, getSale, createSale, updateSale, deleteSale } = require('../controllers/saleController')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)
router.get('/', listSales)
router.post('/', createSale)
router.get('/:id', getSale)
router.put('/:id', updateSale)
router.delete('/:id', deleteSale)

module.exports = router
