const express = require('express')
const router = express.Router()
const { listUsers, getUser, updateUser, platformOverview } = require('../controllers/adminController')
const { overview: userStatsOverview } = require('../controllers/statsController')
const { requireAuth, requireRole } = require('../middleware/auth')

router.use(requireAuth, requireRole(['admin']))

router.get('/overview', platformOverview)
router.get('/users', listUsers)
router.get('/users/:id', getUser)
router.put('/users/:id', updateUser)

// Stats for a specific user (admin views regular user data).
// statsController.overview already supports ?userId= when caller is admin.
router.get('/users/:id/stats', (req, res, next) => {
  req.query.userId = req.params.id
  return userStatsOverview(req, res, next)
})

module.exports = router
