import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { UserType, ContestStatus, TicketStatus } from '../types';
import { adminService } from '../services/adminService';

const router = express.Router();

// Get dashboard stats
router.get('/dashboard', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users with pagination
router.get('/users', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      user_type: req.query.user_type as string,
      status: req.query.status as string,
      search: req.query.search as string,
      sortBy: req.query.sort_by as string,
      sortOrder: req.query.sort_order as 'ASC' | 'DESC'
    };

    const result = await adminService.getUsers(params);

    res.json({
      success: true,
      data: { users: result.users },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user by ID
router.get('/users/:id', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const user = await adminService.getUsers({ 
      page: 1, 
      limit: 1, 
      search: req.params.id 
    });

    if (user.users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user: user.users[0] }
    });
  } catch (error) {
    console.error('Get admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user status
router.patch('/users/:id/status', authenticate, authorize(UserType.ADMIN), [
  body('status').isIn(['active', 'suspended', 'banned'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status } = req.body;

    const user = await adminService.updateUserStatus(req.params.id, status);

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all contests
router.get('/contests', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      status: req.query.status as string,
      type: req.query.type as string,
      search: req.query.search as string,
      sortBy: req.query.sort_by as string,
      sortOrder: req.query.sort_order as 'ASC' | 'DESC'
    };

    const result = await adminService.getContests(params);

    res.json({
      success: true,
      data: { contests: result.contests },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get admin contests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update contest status
router.patch('/contests/:id/status', authenticate, authorize(UserType.ADMIN), [
  body('status').isIn(Object.values(ContestStatus))
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status } = req.body;

    const contest = await adminService.updateContestStatus(req.params.id, status);

    res.json({
      success: true,
      message: 'Contest status updated successfully',
      data: { contest }
    });
  } catch (error) {
    console.error('Update contest status error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete contest
router.delete('/contests/:id', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const result = await adminService.deleteContest(req.params.id);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete contest error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get financial data
router.get('/financial', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      type: req.query.type as string,
      status: req.query.status as string,
      startDate: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
      endDate: req.query.end_date ? new Date(req.query.end_date as string) : undefined
    };

    const result = await adminService.getFinancialData(params);

    res.json({
      success: true,
      data: { 
        transactions: result.transactions,
        summary: result.summary
      },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get financial data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get support tickets
router.get('/support-tickets', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      status: req.query.status as string,
      priority: req.query.priority as string,
      search: req.query.search as string
    };

    const result = await adminService.getSupportTickets(params);

    res.json({
      success: true,
      data: { tickets: result.tickets },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update support ticket status
router.patch('/support-tickets/:id/status', authenticate, authorize(UserType.ADMIN), [
  body('status').isIn(['open', 'in_progress', 'resolved', 'closed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status } = req.body;

    const ticket = await adminService.updateTicketStatus(req.params.id, status);

    res.json({
      success: true,
      message: 'Support ticket status updated successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Update support ticket status error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get system analytics
router.get('/analytics', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const params = {
      startDate: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
      endDate: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
      groupBy: req.query.group_by as 'day' | 'week' | 'month'
    };

    const analytics = await adminService.getSystemAnalytics(params);

    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    console.error('Get system analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get platform health
router.get('/health', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const health = await adminService.getPlatformHealth();

    res.json({
      success: true,
      data: { health }
    });
  } catch (error) {
    console.error('Get platform health error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send system notification
router.post('/notifications', authenticate, authorize(UserType.ADMIN), [
  body('title').notEmpty().trim(),
  body('message').notEmpty().trim(),
  body('type').notEmpty().trim(),
  body('target_users').optional().isArray(),
  body('target_user_type').optional().isIn(Object.values(UserType))
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const notificationData = {
      title: req.body.title,
      message: req.body.message,
      type: req.body.type,
      targetUsers: req.body.target_users,
      targetUserType: req.body.target_user_type
    };

    const notification = await adminService.sendSystemNotification(notificationData);

    res.json({
      success: true,
      message: 'System notification sent successfully',
      data: { notification }
    });
  } catch (error) {
    console.error('Send system notification error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete user
router.delete('/users/:id', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const result = await adminService.deleteUser(req.params.id);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;