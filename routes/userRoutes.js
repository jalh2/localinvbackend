const express = require('express')
const router = express.Router()
const { register, login, logout, getMe, updateMe } = require('../controllers/userController')
const { requireAuth } = require('../middleware/auth')

router.post('/register', register)
router.post('/login', login)
router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, getMe)
router.put('/me', requireAuth, updateMe)

module.exports = router
