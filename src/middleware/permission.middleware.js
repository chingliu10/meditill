const { pool } = require('../config/db');

function requirePermission(code) {
  return async (req,res,next) => {
    try {
      const user = req.session.user;
      if (!user) return res.redirect('/login');

      // OWNER is MediTill's super-role and must not be blocked by a newly-added
      // permission that has not yet been copied into an older browser session.
      if (user.is_owner === true || (Array.isArray(user.roles) && user.roles.includes('OWNER'))) {
        return next();
      }

      if (Array.isArray(user.permissions) && user.permissions.includes(code)) {
        return next();
      }

      // Session permissions can become stale after deployments or role edits.
      // Re-check the database on a cache miss instead of returning a false 403.
      const { rows } = await pool.query(
        `SELECT
           EXISTS(
             SELECT 1
             FROM user_roles ur
             JOIN roles r ON r.id=ur.role_id
             WHERE ur.user_id=$1 AND r.name='OWNER'
           ) AS is_owner,
           EXISTS(
             SELECT 1
             FROM user_roles ur
             JOIN role_permissions rp ON rp.role_id=ur.role_id
             JOIN permissions p ON p.id=rp.permission_id
             WHERE ur.user_id=$1 AND p.code=$2
           ) AS has_permission`,
        [user.id,code]
      );

      const access=rows[0]||{};
      if (access.is_owner || access.has_permission) {
        if (access.is_owner) {
          req.session.user.is_owner=true;
          req.session.user.roles=Array.from(new Set([...(req.session.user.roles||[]),'OWNER']));
        }
        if (access.has_permission) {
          req.session.user.permissions=Array.from(new Set([...(req.session.user.permissions||[]),code]));
        }
        return next();
      }

      const error = new Error('You do not have permission to perform this action');
      error.statusCode = 403;
      next(error);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requirePermission };
