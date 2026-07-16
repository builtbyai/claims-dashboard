const { body, param, query, validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', { errors: errors.array(), path: req.path });
    return res.status(400).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

/**
 * Validation rules for customer operations
 */
const customerValidation = {
  create: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
    body('property_address').optional().trim(),
    body('insurance_company').optional().trim(),
    body('claim_number').optional().trim(),
    handleValidationErrors,
  ],

  update: [
    param('id').isInt({ min: 1 }).withMessage('Invalid customer ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
    body('status').optional().isIn([
      'New Lead',
      'Contact Attempted',
      'Contacted',
      'Site Visit Scheduled',
      'Site Visited',
      'Estimate Sent',
      'Approved',
      'In Progress',
      'Completed',
      'Lost',
    ]).withMessage('Invalid status'),
    handleValidationErrors,
  ],

  get: [
    param('id').isInt({ min: 1 }).withMessage('Invalid customer ID'),
    handleValidationErrors,
  ],

  search: [
    query('search').optional().trim(),
    query('status').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    handleValidationErrors,
  ],
};

/**
 * Validation rules for Kanban operations
 */
const kanbanValidation = {
  move: [
    param('id').isInt({ min: 1 }).withMessage('Invalid customer ID'),
    body('kanban_stage').notEmpty().isIn([
      'Needs Supplement',
      'Supplement Sent',
      'Under Review',
      'Approved',
      'Scheduled',
      'Completed',
    ]).withMessage('Invalid kanban stage'),
    handleValidationErrors,
  ],
};

/**
 * Validation rules for calendar operations
 */
const calendarValidation = {
  updateDate: [
    param('id').isInt({ min: 1 }).withMessage('Invalid customer ID'),
    body('date_roof_scheduled').optional().isISO8601().withMessage('Invalid date format'),
    body('date_roof_completed').optional().isISO8601().withMessage('Invalid date format'),
    handleValidationErrors,
  ],
};

/**
 * Validation rules for authentication
 */
const authValidation = {
  login: [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],

  register: [
    body('username').trim().notEmpty().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
    handleValidationErrors,
  ],
};

module.exports = {
  customerValidation,
  kanbanValidation,
  calendarValidation,
  authValidation,
  handleValidationErrors,
};
