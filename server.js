require('dotenv').config()
const express = require('express')
const cors = require('cors')
const session = require('express-session')
require('./config')
const { notFound, errorHandler } = require('./middleware/errorMiddleware')

const userRoutes = require('./routes/userRoutes')
const settingsRoutes = require('./routes/settingsRoutes')
const storeRoutes = require('./routes/storeRoutes')
const productRoutes = require('./routes/productRoutes')
const purchaseRoutes = require('./routes/purchaseRoutes')
const saleRoutes = require('./routes/saleRoutes')
const statsRoutes = require('./routes/statsRoutes')
const adminRoutes = require('./routes/adminRoutes')

const app = express()

app.use(
  cors({
    origin(origin, callback) {
      return callback(null, true)
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS']
  })
)

app.set('trust proxy', 1)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

const sessionSecret = process.env.SESSION_SECRET || 'default_secret'
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
  }
}))

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Local Inventory Backend API' })
})

app.use('/api/users', userRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/stores', storeRoutes)
app.use('/api/products', productRoutes)
app.use('/api/purchases', purchaseRoutes)
app.use('/api/sales', saleRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/admin', adminRoutes)

app.use(notFound)
app.use(errorHandler)

const port = process.env.PORT || 5000
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
