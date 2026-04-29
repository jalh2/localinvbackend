const express = require('express')
const router = express.Router()
const { overview, timeseries, byProduct } = require('../controllers/statsController')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)
router.get('/overview', overview)
router.get('/timeseries', timeseries)
router.get('/by-product', byProduct)

module.exports = router
