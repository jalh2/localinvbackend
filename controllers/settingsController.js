const UserModel = require('../models/userModel')
const { isCurrency } = require('../utils/currency')

const getSettings = async (req, res) => {
  try {
    const user = await UserModel.findById(req.session.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({
      exchangeRateUsdToLrd: user.exchangeRateUsdToLrd,
      baseCurrency: user.baseCurrency
    })
  } catch (e) {
    res.status(500).json({ message: 'Server error' })
  }
}

const updateSettings = async (req, res) => {
  try {
    const { exchangeRateUsdToLrd, baseCurrency } = req.body
    const data = {}
    if (exchangeRateUsdToLrd !== undefined) {
      const rate = Number(exchangeRateUsdToLrd)
      if (!isFinite(rate) || rate <= 0) return res.status(400).json({ message: 'Invalid exchange rate' })
      data.exchangeRateUsdToLrd = rate
    }
    if (baseCurrency !== undefined) {
      if (!isCurrency(baseCurrency)) return res.status(400).json({ message: 'Invalid currency' })
      data.baseCurrency = baseCurrency
    }
    const user = await UserModel.update(req.session.user.id, data)
    res.json({
      exchangeRateUsdToLrd: user.exchangeRateUsdToLrd,
      baseCurrency: user.baseCurrency
    })
  } catch (e) {
    console.error('updateSettings error:', e)
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { getSettings, updateSettings }
