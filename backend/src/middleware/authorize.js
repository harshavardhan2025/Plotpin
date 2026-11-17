/**
 * Authorization Middleware
 * Enforces role checks, ownership integrity, and prevents self-promotion to admin.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!req.user.roles || !req.user.roles.includes('admin')) {
    return res.status(403).json({
      error: "Access denied: Platform Administrator privileges required",
      code: "ADMIN_FORBIDDEN"
    });
  }

  next();
}

function requireOwnerOrAdmin(propertyFinder) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const propId = req.params.id;
    const property = propertyFinder(propId);

    if (!property) {
      return res.status(404).json({ error: "Property listing not found" });
    }

    const isOwner = property.ownerId === req.user._id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: "Forbidden: You are not authorized to edit or access documents for this property",
        code: "OWNER_INTEGRITY_VIOLATION"
      });
    }

    req.property = property;
    next();
  };
}

module.exports = {
  requireAdmin,
  requireOwnerOrAdmin
};
