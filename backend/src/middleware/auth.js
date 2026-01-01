const jwt = require('jsonwebtoken');
const { User, Organization, AuditLog } = require('../models');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findByPk(decoded.userId, {
        include: [Organization]
      });
      
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }
      
      req.user = user;
      req.organizationId = user.organizationId;
      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Check for specific roles
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        yourRole: req.user.role
      });
    }
    
    next();
  };
};

// Super admin only
const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Organization admin or above
const orgAdminOrAbove = (req, res, next) => {
  const adminRoles = ['super_admin', 'org_admin'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Audit logging middleware
const auditLog = (action, resource) => {
  return async (req, res, next) => {
    // Store original send
    const originalSend = res.send;
    
    res.send = function(body) {
      // Log after response
      if (res.statusCode < 400 && req.user) {
        AuditLog.create({
          userId: req.user.id,
          organizationId: req.organizationId,
          action,
          resource,
          resourceId: req.params.id || null,
          details: {
            method: req.method,
            path: req.path,
            query: req.query,
            statusCode: res.statusCode
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        }).catch(err => console.error('Audit log error:', err));
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};

// Check organization access
const checkOrgAccess = async (req, res, next) => {
  const requestedOrgId = req.params.orgId || req.body.organizationId;
  
  if (!requestedOrgId) {
    return next();
  }
  
  // Super admins can access any org
  if (req.user.role === 'super_admin') {
    return next();
  }
  
  // Others can only access their own org
  if (req.user.organizationId !== requestedOrgId) {
    return res.status(403).json({ error: 'Access denied to this organization' });
  }
  
  next();
};

// Rate limit by organization
const orgRateLimit = (windowMs = 60000, max = 100) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.organizationId || req.ip;
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, { count: 1, startTime: now });
      return next();
    }
    
    const record = requests.get(key);
    
    if (now - record.startTime > windowMs) {
      requests.set(key, { count: 1, startTime: now });
      return next();
    }
    
    if (record.count >= max) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((record.startTime + windowMs - now) / 1000)
      });
    }
    
    record.count++;
    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  superAdminOnly,
  orgAdminOrAbove,
  auditLog,
  checkOrgAccess,
  orgRateLimit
};
