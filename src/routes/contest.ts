import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { UserType, ContestStatus, ContestType, SocialMediaPlatform } from '../types';
import { contestService } from '../services/contestService';
import { AppDataSource } from '../config/database';
import { ContestSubmission } from '../models/ContestSubmission';
import { Contest } from '../models/Contest';
import { SocialMediaAccount } from '../models/SocialMediaAccount';
import { metricsService } from '../services/metricsService';

const router = express.Router();

// Get all contests
router.get('/', async (req, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      status: req.query.status as string,
      type: req.query.type as string,
      search: req.query.search as string
    };

    const result = await contestService.getContests(params);

    res.json({
      success: true,
      data: { contests: result.contests },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get contests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's contests (as brand)
router.get('/user/contests', authenticate, authorize(UserType.BRAND), async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      status: req.query.status as string
    };

    const result = await contestService.getUserContests(req.user.id, params);

    res.json({
      success: true,
      data: { contests: result.contests },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get user contests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's contest participations (as creator)
router.get('/user/participations', authenticate, authorize(UserType.CREATOR), async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };

    const result = await contestService.getUserParticipations(req.user.id, params);

    res.json({
      success: true,
      data: { contests: result.participations },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get user participations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user submissions
router.get('/user/submissions', authenticate, authorize(UserType.CREATOR), async (req: any, res) => {
  try {
    const submissions = await AppDataSource.getRepository(ContestSubmission).find({
      where: { user_id: req.user.id },
      order: { submitted_at: 'DESC' },
      relations: ['contest', 'user']
    });

    res.json({
      success: true,
      data: { submissions }
    });
  } catch (error) {
    console.error('Get user submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get post metrics for contest submissions
router.get('/:id/submissions/:submissionId/metrics', authenticate, authorize(UserType.BRAND), async (req: any, res) => {
  try {
    const { id: contestId, submissionId } = req.params;
    
    // Verify the contest belongs to the brand
    const contest = await contestService.getContestById(contestId);
    if (!contest || contest.brand_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get the submission
    const submission = await AppDataSource.getRepository(ContestSubmission).findOne({
      where: { id: submissionId, contest_id: contestId },
      relations: ['user']
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    if (!submission.post_id || !submission.platform) {
      return res.status(400).json({
        success: false,
        message: 'Post ID or platform not available'
      });
    }

    // Get user's social media account for this platform
    const socialAccount = await AppDataSource.getRepository(SocialMediaAccount).findOne({
      where: { 
        user_id: submission.user_id, 
        platform: submission.platform.toLowerCase() as SocialMediaPlatform
      }
    });

    if (!socialAccount) {
      return res.status(404).json({
        success: false,
        message: 'Social media account not found'
      });
    }

    // Fetch metrics based on platform
    let metrics = {};
    try {
      switch (submission.platform.toLowerCase()) {
        case 'instagram':
          metrics = await fetchInstagramPostMetrics(submission.post_id, socialAccount.access_token);
          break;
        case 'tiktok':
          metrics = await fetchTikTokPostMetrics(submission.post_id, socialAccount.access_token);
          break;
        case 'youtube':
          metrics = await fetchYouTubePostMetrics(submission.post_id, socialAccount.access_token);
          break;
        case 'facebook':
          metrics = await fetchFacebookPostMetrics(submission.post_id, socialAccount.access_token);
          break;
        case 'twitter':
        case 'x':
          metrics = await fetchTwitterPostMetrics(submission.post_id, socialAccount.access_token);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Unsupported platform'
          });
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch metrics'
      });
    }

    res.json({
      success: true,
      data: { metrics }
    });
  } catch (error) {
    console.error('Get post metrics error:', error);
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

// Get contest by ID
router.get('/:id', async (req, res) => {
  try {
    const contest = await contestService.getContestById(req.params.id);

    res.json({
      success: true,
      data: { contest }
    });
  } catch (error) {
    console.error('Get contest error:', error);
    if (error instanceof Error && error.message === 'Contest not found') {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create contest (brand only)
router.post('/', authenticate, authorize(UserType.BRAND), [
  body('title').notEmpty().trim().escape(),
  body('description').notEmpty().trim(),
  body('contest_type').isIn(Object.values(ContestType)),
  body('prize_pool').isNumeric().isFloat({ min: 0 }),
  body('entry_fee').isNumeric().isFloat({ min: 0 }),
  body('start_date').isISO8601(),
  body('end_date').isISO8601(),
  body('submission_deadline').isISO8601(),
  body('requirements').notEmpty().trim(),
  body('judging_criteria').notEmpty().trim(),
  body('tags').isArray(),
  body('max_participants').optional().isInt({ min: 1 })
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

    const {
      title,
      description,
      contest_type,
      prize_pool,
      entry_fee,
      start_date,
      end_date,
      submission_deadline,
      requirements,
      judging_criteria,
      tags,
      max_participants,
      cover_image_url
    } = req.body;

    const contestData = {
      title,
      description,
      brand_id: req.user.id,
      contest_type,
      prize_pool,
      entry_fee,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      submission_deadline: new Date(submission_deadline),
      requirements,
      judging_criteria,
      tags,
      max_participants,
      cover_image_url
    };

    const contest = await contestService.createContest(contestData);

    res.status(201).json({
      success: true,
      message: 'Contest created successfully',
      data: { contest }
    });
  } catch (error) {
    console.error('Create contest error:', error);
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

// Join contest
router.post('/:id/join', authenticate, async (req: any, res) => {
  try {
    const participation = await contestService.joinContest(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Successfully joined contest'
    });
  } catch (error) {
    console.error('Join contest error:', error);
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

// Submit to contest
router.post('/:id/submit', authenticate, [
  body('submission_url').notEmpty().isURL(),
  body('description').notEmpty().trim(),
  body('post_id').optional().isString(),
  body('platform').optional().isString()
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

    const { submission_url, description, post_id, platform } = req.body;

    const submission = await contestService.submitToContest(
      req.params.id,
      req.user.id,
      { 
        submission_url, 
        description,
        post_id,
        platform
      }
    );

    res.status(201).json({
      success: true,
      message: 'Submission successful',
      data: { submission }
    });
  } catch (error) {
    console.error('Submit to contest error:', error);
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

// Update contest status (brand only)
router.patch('/:id/status', authenticate, authorize(UserType.BRAND), [
  body('status').isIn(Object.values(ContestStatus))
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

    const contest = await contestService.updateContestStatus(
      req.params.id,
      req.user.id,
      status
    );

    res.json({
      success: true,
      message: 'Contest status updated successfully'
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

// Get contest submissions (brand only)
router.get('/:id/submissions', authenticate, authorize(UserType.BRAND), async (req: any, res) => {
  try {
    const submissions = await contestService.getContestSubmissions(
      req.params.id,
      req.user.id
    );

    res.json({
      success: true,
      data: { submissions }
    });
  } catch (error) {
    console.error('Get contest submissions error:', error);
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



// Get contest entries (submissions)
router.get('/entries', authenticate, async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      contestId: req.query.contestId as string
    };

    const entries = await contestService.getContestEntries(params);

    res.json({
      success: true,
      data: { entries }
    });
  } catch (error) {
    console.error('Get contest entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Boost contest
router.post('/:id/boost', authenticate, authorize(UserType.BRAND), [
  body('boost_amount').isNumeric().withMessage('Boost amount must be a number'),
  body('boost_amount').isFloat({ min: 1 }).withMessage('Boost amount must be at least 1')
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

    const { boost_amount } = req.body;
    const contestId = req.params.id;

    const result = await contestService.boostContest(contestId, req.user.id, boost_amount);

    if (result.success) {
      res.json({
        success: true,
        message: 'Contest boosted successfully',
        data: { contest: result.contest }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Boost contest error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper functions for fetching post metrics
async function fetchInstagramPostMetrics(postId: string, accessToken: string) {
  try {
    const response = await fetch(`https://graph.instagram.com/${postId}?fields=like_count,comments_count,media_type&access_token=${accessToken}`);
    const data: any = await response.json();
    
    return {
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
      shares: 0, // Instagram doesn't provide share count
      views: 0  // Instagram doesn't provide view count for posts
    };
  } catch (error) {
    console.error('Instagram metrics error:', error);
    throw error;
  }
}

async function fetchTikTokPostMetrics(postId: string, accessToken: string) {
  try {
    const response = await fetch('https://open.tiktokapis.com/v2/video/query/?fields=id,title,like_count,comment_count,view_count,share_count', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filters: { 
          video_ids: [postId]
        }
      })
    });
    
    const data: any = await response.json();
    
    if (!data.data || !data.data.videos || data.data.videos.length === 0) {
      throw new Error('Video not found');
    }
    
    const video = data.data.videos[0];
    
    return {
      likes: video.like_count || 0,
      comments: video.comment_count || 0,
      shares: video.share_count || 0,
      views: video.view_count || 0
    };
  } catch (error) {
    console.error('TikTok metrics error:', error);
    throw error;
  }
}

async function fetchYouTubePostMetrics(postId: string, accessToken: string) {
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${postId}&access_token=${accessToken}`);
    const data: any = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const stats = data.items[0].statistics;
    
    return {
      likes: parseInt(stats.likeCount) || 0,
      comments: parseInt(stats.commentCount) || 0,
      shares: 0, // YouTube doesn't provide share count
      views: parseInt(stats.viewCount) || 0
    };
  } catch (error) {
    console.error('YouTube metrics error:', error);
    throw error;
  }
}

async function fetchFacebookPostMetrics(postId: string, accessToken: string) {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`);
    const data: any = await response.json();
    
    return {
      likes: data.likes?.summary?.total_count || 0,
      comments: data.comments?.summary?.total_count || 0,
      shares: data.shares?.count || 0,
      views: 0 // Facebook doesn't provide view count for posts
    };
  } catch (error) {
    console.error('Facebook metrics error:', error);
    throw error;
  }
}

async function fetchTwitterPostMetrics(postId: string, accessToken: string) {
  try {
    const response = await fetch(`https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const data: any = await response.json();
    
    if (!data.data) {
      throw new Error('Tweet not found');
    }
    
    const metrics = data.data.public_metrics;
    
    return {
      likes: metrics.like_count || 0,
      comments: metrics.reply_count || 0,
      shares: metrics.retweet_count || 0,
      views: metrics.impression_count || 0
    };
  } catch (error) {
    console.error('Twitter metrics error:', error);
    throw error;
  }
}

// Complete contest and select winners
router.post('/:id/complete', authenticate, authorize(UserType.BRAND), async (req: any, res) => {
  try {
    const { id: contestId } = req.params;
    
    const result = await contestService.completeContest(contestId, req.user.id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Contest completed successfully',
        data: {
          contest: result.contest,
          winners: result.winners
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Complete contest error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get contest winners
router.get('/:id/winners', async (req: any, res) => {
  try {
    const { id: contestId } = req.params;
    
    const result = await contestService.getContestWinners(contestId);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          winners: result.winners
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Get contest winners error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get contest leaderboard
router.get('/:id/leaderboard', async (req: any, res) => {
  try {
    const { id: contestId } = req.params;
    
    // Get contest with submissions
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id: contestId },
      relations: ['submissions', 'submissions.user']
    });

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Get all submissions
    const submissions = await AppDataSource.getRepository(ContestSubmission).find({
      where: { contest_id: contestId },
      relations: ['user'],
      order: { submitted_at: 'ASC' }
    });

    if (submissions.length === 0) {
      return res.json({
        success: true,
        data: {
          entries: [],
          contest: contest
        }
      });
    }

    // Calculate scores based on contest's judging method
    let scoredSubmissions = [];
    
    if (contest.judging_method === 'engagement') {
      scoredSubmissions = await calculateEngagementScores(submissions, contest.engagement_weights);
    } else {
      // For manual or hybrid judging, use engagement scores as fallback
      scoredSubmissions = await calculateEngagementScores(submissions, contest.engagement_weights);
    }

    // Sort by score (highest first) and add rank
    scoredSubmissions.sort((a, b) => b.score - a.score);
    const entries = scoredSubmissions.map((submission, index) => ({
      id: submission.id,
      contest_id: contestId,
      creator_id: submission.user_id,
      creator_name: submission.user.profile?.full_name || submission.user.username,
      post_url: submission.post_url,
      likes: submission.metrics?.likes || 0,
      comments: submission.metrics?.comments || 0,
      shares: submission.metrics?.shares || 0,
      views: submission.metrics?.views || 0,
      score: submission.score,
      rank: index + 1,
      created_at: submission.submitted_at
    }));

    res.json({
      success: true,
      data: {
        entries,
        contest: contest
      }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper function to calculate engagement scores
async function calculateEngagementScores(submissions: any[], weights: any) {
  const scoredSubmissions = [];

  for (const submission of submissions) {
    // Get latest metrics for this submission
    const latestMetrics = await metricsService.getLatestMetrics(submission.id);
    
    let score = 0;
    let metrics = {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0
    };

    if (latestMetrics) {
      metrics = {
        likes: latestMetrics.likes,
        comments: latestMetrics.comments,
        shares: latestMetrics.shares,
        views: latestMetrics.views
      };
      score = latestMetrics.engagement_score;
    } else {
      // If no metrics found, try to fetch them
      console.log('No metrics found for submission:', submission.id, 'attempting to fetch...');
      const fetchedMetrics = await metricsService.fetchAndStoreMetrics(submission.id);
      
      if (fetchedMetrics) {
        metrics = {
          likes: fetchedMetrics.likes,
          comments: fetchedMetrics.comments,
          shares: fetchedMetrics.shares,
          views: fetchedMetrics.views
        };
        score = fetchedMetrics.engagement_score;
      }
    }

    scoredSubmissions.push({
      ...submission,
      score,
      metrics
    });
  }

  return scoredSubmissions;
}

// Refresh metrics for all submissions in a contest
router.post('/:id/refresh-metrics', authenticate, authorize(UserType.BRAND), async (req: any, res) => {
  try {
    const { id: contestId } = req.params;
    
    // Verify the contest belongs to the brand
    const contest = await contestService.getContestById(contestId);
    if (!contest || contest.brand_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Fetch and store metrics for all submissions
    const metrics = await metricsService.fetchContestMetrics(contestId);
    
    res.json({
      success: true,
      message: `Refreshed metrics for ${metrics.length} submissions`,
      data: {
        metrics_count: metrics.length
      }
    });
  } catch (error) {
    console.error('Refresh metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;