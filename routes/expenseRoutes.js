const express = require('express')
const router = express.Router()
const { listExpenses, getExpense, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController')
const { requireAuth, requireNotEmployee } = require('../middleware/auth')

router.use(requireAuth)
router.get('/', listExpenses)
router.post('/', createExpense)
router.get('/:id', getExpense)
router.put('/:id', updateExpense)
router.delete('/:id', requireNotEmployee, deleteExpense)

module.exports = router
