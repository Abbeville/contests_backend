import express from 'express';
import { body, validationResult } from 'express-validator';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { SocialMediaAccount } from '../models/SocialMediaAccount';
import { authenticate, authorize } from '../middleware/auth';
import { UserType } from '../types';
import { userService } from '../services/userService';

const router = express.Router();

// Get user profile
router.get('/profile', authenticate, async (req: any, res) => {
  try {
    const user = await userService.getUserProfile(req.user.id);

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    if (error instanceof Error && error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user profile
router.put('/profile', authenticate, [
  body('first_name').optional().trim().escape(),
  body('last_name').optional().trim().escape(),
  body('bio').optional().trim(),
  body('phone').optional().trim(),
  body('location').optional().trim(),
  body('website').optional().trim(),
  body('profile_image_url').optional().trim(),
  body('date_of_birth').optional().isISO8601(),
  body('gender').optional().trim(),
  body('interests').optional().isArray()
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

    const profileData = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      bio: req.body.bio,
      phone: req.body.phone,
      location: req.body.location,
      website: req.body.website,
      profile_image_url: req.body.profile_image_url,
      date_of_birth: req.body.date_of_birth ? new Date(req.body.date_of_birth) : undefined,
      gender: req.body.gender,
      interests: req.body.interests
    };

    const user = await userService.updateUserProfile(req.user.id, profileData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
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

// Get user dashboard data
router.get('/dashboard', authenticate, async (req: any, res) => {
  try {
    const user = await userService.getUserProfile(req.user.id);
    const stats = await userService.getUserStats(req.user.id);

    res.json({
      success: true,
      data: {
        user,
        stats
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    if (error instanceof Error && error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get current user's stats (must be before '/:id' admin route)
router.get('/stats', authenticate, async (req: any, res) => {
  try {
    const stats = await userService.getUserStats(req.user.id);
    res.json({ success: true, data: { stats } });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get user's social media accounts
router.get('/social-accounts', authenticate, async (req: any, res) => {
  try {
    const accounts = await AppDataSource.getRepository(SocialMediaAccount).find({
      where: { user_id: req.user.id },
      order: { created_at: 'DESC' }
    });

    res.json({
      success: true,
      data: { accounts }
    });
  } catch (error) {
    console.error('Get social accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users (admin only)
router.get('/', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await AppDataSource.getRepository(User).findAndCount({
      relations: ['profile', 'wallet'],
      skip,
      take: limit,
      order: { created_at: 'DESC' }
    });

    res.json({
      success: true,
      data: { users },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user by ID (admin only)
router.get('/:id', authenticate, authorize(UserType.ADMIN), async (req, res) => {
  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: req.params.id },
      relations: ['profile', 'wallet', 'social_accounts']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user status (admin only)
router.patch('/:id/status', authenticate, authorize(UserType.ADMIN), [
  body('is_active').isBoolean(),
  body('is_verified').isBoolean()
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

    const { is_active, is_verified } = req.body;

    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: req.params.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.is_active = is_active;
    user.is_verified = is_verified;

    await AppDataSource.getRepository(User).save(user);

    res.json({
      success: true,
      message: 'User status updated successfully'
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update password
router.put('/password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 6 })
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

    const { current_password, new_password } = req.body;

    const result = await userService.updatePassword(
      req.user.id,
      current_password,
      new_password
    );

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Update password error:', error);
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

// Get user wallet
router.get('/wallet', authenticate, async (req: any, res) => {
  try {
    const wallet = await userService.getUserWallet(req.user.id);

    res.json({
      success: true,
      data: { wallet }
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    if (error instanceof Error && error.message === 'Wallet not found') {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user transactions
router.get('/transactions', authenticate, async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      type: req.query.type as string
    };

    const result = await userService.getUserTransactions(req.user.id, params);

    res.json({
      success: true,
      data: { transactions: result.transactions },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add funds to wallet
router.post('/wallet/add-funds', authenticate, [
  body('amount').isNumeric().isFloat({ min: 1 }),
  body('payment_method').notEmpty().trim()
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

    const { amount, payment_method } = req.body;

    const wallet = await userService.addFunds(req.user.id, amount, payment_method);

    res.json({
      success: true,
      message: 'Funds added successfully',
      data: { wallet }
    });
  } catch (error) {
    console.error('Add funds error:', error);
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

// Connect social media account
router.post('/social-connect', authenticate, [
  body('platform').notEmpty().trim(),
  body('username').notEmpty().trim(),
  body('access_token').notEmpty().trim()
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

    const socialData = {
      platform: req.body.platform,
      username: req.body.username,
      access_token: req.body.access_token,
      refresh_token: req.body.refresh_token,
      profile_url: req.body.profile_url,
      follower_count: req.body.follower_count
    };

    const account = await userService.connectSocialMedia(req.user.id, socialData);

    res.json({
      success: true,
      message: 'Social media account connected successfully',
      data: { account }
    });
  } catch (error) {
    console.error('Connect social media error:', error);
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

// Disconnect social media account
router.delete('/social-disconnect/:platform', authenticate, async (req: any, res) => {
  try {
    const result = await userService.disconnectSocialMedia(req.user.id, req.params.platform);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Disconnect social media error:', error);
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

// Admin routes
// Get all users (admin only)
router.get('/admin/users', authenticate, authorize(UserType.ADMIN), async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      user_type: req.query.user_type as string,
      search: req.query.search as string
    };

    const result = await userService.getAllUsers(params);

    res.json({
      success: true,
      data: { users: result.users },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user status (admin only)
router.patch('/admin/users/:id/status', authenticate, authorize(UserType.ADMIN), [
  body('status').isIn(['active', 'suspended', 'banned'])
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

    const user = await userService.updateUserStatus(req.params.id, status);

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

export default router;