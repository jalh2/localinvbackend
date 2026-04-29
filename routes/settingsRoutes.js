const express = require('express')
const router = express.Router()
const { getSettings, updateSettings } = require('../controllers/settingsController')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, getSettings)
router.put('/', requireAuth, updateSettings)

module.exports = router
