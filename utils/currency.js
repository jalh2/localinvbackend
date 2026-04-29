const CURRENCIES = ['USD', 'LRD']

const isCurrency = c => CURRENCIES.includes(c)

// Convert an amount from `from` currency to `to` currency given a USD->LRD rate.
// rate represents how many LRD equal 1 USD.
const convert = (amount, from, to, rate) => {
  if (typeof amount !== 'number' || !isFinite(amount)) return 0
  if (!rate || rate <= 0) rate = 1
  if (from === to) return amount
  if (from === 'USD' && to === 'LRD') return amount * rate
  if (from === 'LRD' && to === 'USD') return amount / rate
  return amount
}

module.exports = { CURRENCIES, isCurrency, convert }
