const express = require('express')
const router = express.Router()
const { listProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/productController')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)
router.get('/', listProducts)
router.post('/', createProduct)
router.get('/:id', getProduct)
router.put('/:id', updateProduct)
router.delete('/:id', deleteProduct)

module.exports = router
