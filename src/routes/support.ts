import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { UserType, TicketStatus, TicketPriority } from '../types';
import { supportService } from '../services/supportService';

const router = express.Router();

// Create support ticket
router.post('/tickets', authenticate, [
  body('subject').notEmpty().trim().escape(),
  body('description').notEmpty().trim(),
  body('category').notEmpty().trim(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('attachments').optional().isArray()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const ticketData = {
      subject: req.body.subject,
      description: req.body.description,
      category: req.body.category,
      priority: req.body.priority || 'medium',
      attachments: req.body.attachments
    };

    const ticket = await supportService.createTicket(req.user.id, ticketData);

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
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

// Get user's support tickets
router.get('/tickets', authenticate, async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      status: req.query.status as string,
      priority: req.query.priority as string
    };

    const result = await supportService.getUserTickets(req.user.id, params);

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

// Get support ticket by ID
router.get('/tickets/:id', authenticate, async (req: any, res) => {
  try {
    const ticket = await supportService.getTicketById(req.params.id, req.user.id);

    res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Get support ticket error:', error);
    if (error instanceof Error && error.message === 'Support ticket not found') {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add message to support ticket
router.post('/tickets/:id/messages', authenticate, [
  body('message').notEmpty().trim(),
  body('attachments').optional().isArray()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const messageData = {
      message: req.body.message,
      attachments: req.body.attachments
    };

    const message = await supportService.addMessage(
      req.params.id,
      req.user.id,
      messageData
    );

    res.status(201).json({
      success: true,
      message: 'Message added successfully',
      data: { message }
    });
  } catch (error) {
    console.error('Add message error:', error);
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

// Get support statistics
router.get('/stats', authenticate, async (req: any, res) => {
  try {
    const stats = await supportService.getSupportStats();

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get support stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get ticket categories
router.get('/categories', authenticate, async (req: any, res) => {
  try {
    const categories = await supportService.getTicketCategories();

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('Get ticket categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Search tickets
router.get('/search', authenticate, async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      query: req.query.q as string,
      status: req.query.status as string,
      priority: req.query.priority as string,
      category: req.query.category as string
    };

    if (!params.query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const result = await supportService.searchTickets(params);

    res.json({
      success: true,
      data: { tickets: result.tickets },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Search tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Admin routes
// Get all support tickets (admin)
router.get('/admin/tickets', authenticate, authorize(UserType.ADMIN), async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      status: req.query.status as string,
      priority: req.query.priority as string,
      category: req.query.category as string,
      search: req.query.search as string,
      assigned_to: req.query.assigned_to as string
    };

    const result = await supportService.getAllTickets(params);

    res.json({
      success: true,
      data: { tickets: result.tickets },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get all support tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update ticket status (admin)
router.patch('/admin/tickets/:id/status', authenticate, authorize(UserType.ADMIN), [
  body('status').isIn(['open', 'in_progress', 'resolved', 'closed'])
], async (req: any, res) => {
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

    const ticket = await supportService.updateTicketStatus(
      req.params.id,
      status,
      req.user.id
    );

    res.json({
      success: true,
      message: 'Ticket status updated successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Update ticket status error:', error);
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

// Assign ticket to admin
router.patch('/admin/tickets/:id/assign', authenticate, authorize(UserType.ADMIN), [
  body('admin_id').isUUID()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { admin_id } = req.body;

    const ticket = await supportService.assignTicket(req.params.id, admin_id);

    res.json({
      success: true,
      message: 'Ticket assigned successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
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

// Close ticket (admin)
router.patch('/admin/tickets/:id/close', authenticate, authorize(UserType.ADMIN), [
  body('resolution').optional().trim()
], async (req: any, res) => {
  try {
    const { resolution } = req.body;

    const ticket = await supportService.closeTicket(
      req.params.id,
      req.user.id,
      resolution
    );

    res.json({
      success: true,
      message: 'Ticket closed successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Close ticket error:', error);
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

// Add admin message to ticket
router.post('/admin/tickets/:id/messages', authenticate, authorize(UserType.ADMIN), [
  body('message').notEmpty().trim(),
  body('attachments').optional().isArray()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const messageData = {
      message: req.body.message,
      attachments: req.body.attachments,
      is_from_support: true
    };

    const message = await supportService.addMessage(
      req.params.id,
      req.user.id,
      messageData
    );

    res.status(201).json({
      success: true,
      message: 'Admin message added successfully',
      data: { message }
    });
  } catch (error) {
    console.error('Add admin message error:', error);
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