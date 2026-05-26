const express = require('express')
const router = express.Router()
const { listProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/productController')
const { requireAuth, requireNotEmployee } = require('../middleware/auth')

router.use(requireAuth)
router.get('/', listProducts)
router.post('/', createProduct)
router.get('/:id', getProduct)
router.put('/:id', updateProduct)
router.delete('/:id', requireNotEmployee, deleteProduct)

module.exports = router
