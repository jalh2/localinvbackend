// Auth is intentionally relaxed: the frontend is trusted to verify the user.
// These middlewares no longer block requests. They only normalize the caller
// identity onto req.session.user so the existing controller logic (ownership
// scoping, admin checks, etc.) keeps working.
//
// The frontend should send the current user's id and role on each request via:
//   - header  x-user-id     (preferred)
//   - header  x-user-role   ('admin' | 'user', defaults to 'user')
// Falls back to userId/role in query string or body if headers are absent.

const ensureIdentity = (req) => {
  if (req.session && req.session.user && req.session.user.id) return
  const id =
    req.header('x-user-id') ||
    (req.query && req.query.userId) ||
    (req.body && req.body.userId) ||
    null
  const role =
    req.header('x-user-role') ||
    (req.query && req.query.role) ||
    (req.body && req.body.role) ||
    'user'
  if (id) {
    req.session = req.session || {}
    req.session.user = { id, role }
  }
}

const requireAuth = (req, res, next) => {
  ensureIdentity(req)
  next()
}

const requireRole = () => (req, res, next) => {
  ensureIdentity(req)
  next()
}

// Blocks employees from performing destructive operations.
// storeRole is sent as the x-store-role header (or falls back to 'owner').
const requireNotEmployee = (req, res, next) => {
  ensureIdentity(req)
  const storeRole =
    req.header('x-store-role') ||
    (req.session && req.session.user && req.session.user.storeRole) ||
    'owner'
  if (storeRole === 'employee') {
    return res.status(403).json({ message: 'Employees are not allowed to delete records.' })
  }
  next()
}

module.exports = { requireAuth, requireRole, requireNotEmployee }
