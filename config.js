const admin = require('firebase-admin')
const path = require('path')

// Local development - service account file referenced by GOOGLE_APPLICATION_CREDENTIALS
const serviceAccountPath = path.resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS || './localinventory-service-account.json')
const serviceAccount = require(serviceAccountPath)

// Production - uncomment to use environment variable instead:
// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
// if (serviceAccount.private_key) {
//   serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
// }

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

console.log('Firebase Admin initialized, Firestore connected.')

module.exports = { admin, db }
