const jwt = require('jsonwebtoken');
const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
const JWT_EXPIRY = '7d'; // 7 days

// JWT Strategy configuration
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      // In a real app, verify user exists in database
      // For now, we'll accept the token if it's valid
      return done(null, payload);
    } catch (error) {
      return done(error, false);
    }
  })
);

// Middleware to verify JWT token
const authenticateJWT = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (error, user, info) => {
    if (error) {
      return res.status(500).json({ error: 'Authentication error', details: error.message });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: info ? info.message : 'Invalid or missing token'
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (error, user) => {
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
};

// Role-based authorization middleware
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const userRole = req.user.role || 'user';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires one of: ${allowedRoles.join(', ')}. Your role: ${userRole}`
      });
    }

    next();
  };
};

// Generate JWT token
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'user',
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

// Verify and decode token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = {
  passport,
  authenticateJWT,
  optionalAuth,
  authorizeRoles,
  generateToken,
  verifyToken,
  JWT_SECRET,
  JWT_EXPIRY,
};
