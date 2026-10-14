function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireUserOrAdmin = requireRole('admin', 'user', 'analyst');
const requireAnalystOrAdmin = requireUserOrAdmin;

module.exports = { requireRole, requireAdmin, requireUserOrAdmin, requireAnalystOrAdmin };
