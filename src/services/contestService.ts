import { AppDataSource } from '../config/database';
import { Contest } from '../models/Contest';
import { ContestParticipant } from '../models/ContestParticipant';
import { ContestSubmission } from '../models/ContestSubmission';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { Wallet } from '../models/Wallet';
import { ContestStatus, ContestType, TransactionType, TransactionStatus } from '../types';
import { metricsService } from './metricsService';

export class ContestService {
  // Get all contests with pagination and filters
  async getContests(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(Contest)
      .createQueryBuilder('contest')
      .leftJoinAndSelect('contest.brand', 'brand')
      .leftJoinAndSelect('brand.profile', 'brandProfile')
      .leftJoinAndSelect('contest.participants', 'participants')
      .leftJoinAndSelect('contest.submissions', 'submissions')
      .orderBy('contest.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    // Apply filters
    if (params.status) {
      queryBuilder.andWhere('contest.status = :status', { status: params.status });
    }
    if (params.type) {
      queryBuilder.andWhere('contest.contest_type = :type', { type: params.type });
    }
    if (params.search) {
      queryBuilder.andWhere(
        '(contest.title LIKE :search OR contest.description LIKE :search)',
        { search: `%${params.search}%` }
      );
    }

    const [contests, total] = await queryBuilder.getManyAndCount();

    return {
      contests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get contest by ID with all relations
  async getContestById(id: string) {
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id },
      relations: [
        'brand',
        'brand.profile',
        'participants',
        'participants.user',
        'submissions',
        'submissions.user'
      ]
    });

    if (!contest) {
      throw new Error('Contest not found');
    }

    return contest;
  }

  // Create a new contest
  async createContest(contestData: {
    title: string;
    description: string;
    brand_id: string;
    contest_type: ContestType;
    platform?: string;
    prize_pool: number;
    entry_fee: number;
    start_date: Date;
    end_date: Date;
    submission_deadline: Date;
    max_participants?: number;
    requirements: string;
    judging_criteria: string;
    judging_method?: string;
    engagement_weights?: {
      likes: number;
      comments: number;
      shares: number;
      views: number;
    };
    tags: string[];
    cover_image_url?: string;
  }) {
    // Validate dates
    if (contestData.start_date >= contestData.end_date) {
      throw new Error('Start date must be before end date');
    }
    if (contestData.submission_deadline >= contestData.end_date) {
      throw new Error('Submission deadline must be before end date');
    }

    // Check if brand has sufficient balance
    const wallet = await AppDataSource.getRepository(Wallet).findOne({
      where: { user_id: contestData.brand_id }
    });

    // Calculate platform fee (10% of prize pool)
    const platformFee = Math.round(contestData.prize_pool * 0.10);
    const totalCost = contestData.prize_pool + platformFee;

    if (!wallet || wallet.balance < totalCost) {
      throw new Error(`Insufficient balance. Required: ₦${totalCost.toLocaleString()} (Prize: ₦${contestData.prize_pool.toLocaleString()} + Platform Fee: ₦${platformFee.toLocaleString()})`);
    }

    // Create contest
    const contest = new Contest();
    Object.assign(contest, contestData);
    contest.status = ContestStatus.ACTIVE; // Set as ACTIVE so it's visible to creators

    const savedContest = await AppDataSource.getRepository(Contest).save(contest);

    // Deduct total cost (prize pool + platform fee) from wallet
    wallet.balance -= totalCost;
    await AppDataSource.getRepository(Wallet).save(wallet);

    // Create transaction record for prize pool
    const prizeTransaction = new Transaction();
    prizeTransaction.wallet_id = wallet.id;
    prizeTransaction.user_id = contestData.brand_id;
    prizeTransaction.amount = contestData.prize_pool;
    prizeTransaction.transaction_type = TransactionType.CONTEST_CREATION;
    prizeTransaction.status = TransactionStatus.COMPLETED;
    prizeTransaction.description = `Contest creation: ${contestData.title} (Prize Pool)`;
    await AppDataSource.getRepository(Transaction).save(prizeTransaction);

    // Create transaction record for platform fee
    const feeTransaction = new Transaction();
    feeTransaction.wallet_id = wallet.id;
    feeTransaction.user_id = contestData.brand_id;
    feeTransaction.amount = platformFee;
    feeTransaction.transaction_type = TransactionType.PLATFORM_FEE;
    feeTransaction.status = TransactionStatus.COMPLETED;
    feeTransaction.description = `Platform fee: ${contestData.title}`;
    await AppDataSource.getRepository(Transaction).save(feeTransaction);

    return savedContest;
  }

  // Join a contest
  async joinContest(contestId: string, userId: string) {
    // Check if contest exists and is active
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id: contestId }
    });

    if (!contest) {
      throw new Error('Contest not found');
    }

    if (contest.status !== ContestStatus.ACTIVE) {
      throw new Error('Contest is not active');
    }

    // Check if user already joined
    const existingParticipation = await AppDataSource.getRepository(ContestParticipant).findOne({
      where: { contest_id: contestId, user_id: userId }
    });

    if (existingParticipation) {
      throw new Error('Already joined this contest');
    }

    // Check max participants
    if (contest.max_participants) {
      const participantCount = await AppDataSource.getRepository(ContestParticipant).count({
        where: { contest_id: contestId }
      });

      if (participantCount >= contest.max_participants) {
        throw new Error('Contest is full');
      }
    }

    // Process entry fee if required
    if (contest.entry_fee > 0) {
      const wallet = await AppDataSource.getRepository(Wallet).findOne({
        where: { user_id: userId }
      });

      if (!wallet || wallet.balance < contest.entry_fee) {
        throw new Error('Insufficient balance for entry fee');
      }

      // Deduct entry fee
      wallet.balance -= contest.entry_fee;
      await AppDataSource.getRepository(Wallet).save(wallet);

      // Create transaction record
      const transaction = new Transaction();
      transaction.wallet_id = wallet.id;
      transaction.user_id = userId; // Add missing user_id
      transaction.amount = contest.entry_fee;
      transaction.transaction_type = TransactionType.CONTEST_CREATION;
      transaction.status = TransactionStatus.COMPLETED;
      transaction.description = `Entry fee for contest: ${contest.title}`;
      await AppDataSource.getRepository(Transaction).save(transaction);
    }

    // Create participation record
    const participation = new ContestParticipant();
    participation.contest_id = contestId;
    participation.user_id = userId;

    return await AppDataSource.getRepository(ContestParticipant).save(participation);
  }

  // Submit to contest
  async submitToContest(contestId: string, userId: string, submissionData: {
    submission_url: string; // Keep this for frontend compatibility
    post_id?: string; // Add post ID for analytics
    platform?: string; // Add platform for analytics
    title?: string; // Optional for now
    description: string;
  }) {
    // Check if contest exists and is active
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id: contestId }
    });

    if (!contest) {
      throw new Error('Contest not found');
    }

    if (contest.status !== ContestStatus.ACTIVE) {
      throw new Error('Contest is not active');
    }

    // Check if user joined the contest
    const participation = await AppDataSource.getRepository(ContestParticipant).findOne({
      where: { contest_id: contestId, user_id: userId }
    });

    if (!participation) {
      throw new Error('Must join contest before submitting');
    }

    // Check if submission deadline has passed
    if (new Date() > contest.submission_deadline) {
      throw new Error('Submission deadline has passed');
    }

    // Check if user already submitted
    const existingSubmission = await AppDataSource.getRepository(ContestSubmission).findOne({
      where: { contest_id: contestId, user_id: userId }
    });

    if (existingSubmission) {
      throw new Error('Already submitted to this contest');
    }

    // Create submission
    const submission = new ContestSubmission();
    submission.contest_id = contestId;
    submission.user_id = userId;
    submission.post_url = submissionData.submission_url; // Map submission_url to post_url
    submission.post_id = submissionData.post_id; // Store post ID for analytics
    submission.platform = submissionData.platform; // Store platform for analytics
    submission.post_content = submissionData.description; // Map description to post_content
    submission.status = 'submitted'; // Set default status

    return await AppDataSource.getRepository(ContestSubmission).save(submission);
  }

  // Update contest status
  async updateContestStatus(contestId: string, brandUserId: string, status: ContestStatus) {
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id: contestId, brand_id: brandUserId }
    });

    if (!contest) {
      throw new Error('Contest not found or access denied');
    }

    contest.status = status;
    return await AppDataSource.getRepository(Contest).save(contest);
  }

  // Get contest submissions (brand only)
  async getContestSubmissions(contestId: string, brandUserId: string) {
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id: contestId, brand_id: brandUserId }
    });

    if (!contest) {
      throw new Error('Contest not found or access denied');
    }

    const submissions = await AppDataSource.getRepository(ContestSubmission).find({
      where: { contest_id: contestId },
      relations: ['user'],
      order: { submitted_at: 'DESC' }
    });

    return submissions;
  }

  // Get user's contests (as brand)
  async getUserContests(userId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(Contest)
      .createQueryBuilder('contest')
      .where('contest.brand_id = :userId', { userId })
      .orderBy('contest.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.status) {
      queryBuilder.andWhere('contest.status = :status', { status: params.status });
    }

    const [contests, total] = await queryBuilder.getManyAndCount();

    return {
      contests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get user's contest participations (as creator)
  async getUserParticipations(userId: string, params: {
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const [participations, total] = await AppDataSource.getRepository(ContestParticipant)
      .findAndCount({
        where: { user_id: userId },
        relations: ['contest', 'contest.brand'],
        order: { joined_at: 'DESC' },
        skip,
        take: limit
      });

    return {
      participations: participations.map(p => p.contest),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get contest entries (submissions)
  async getContestEntries(params: {
    page?: number;
    limit?: number;
    contestId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(ContestSubmission)
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.contest', 'contest')
      .leftJoinAndSelect('submission.user', 'user')
      .orderBy('submission.submitted_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.contestId) {
      queryBuilder.andWhere('submission.contest_id = :contestId', { contestId: params.contestId });
    }

    const [entries, total] = await queryBuilder.getManyAndCount();

    return {
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Boost contest
  async boostContest(contestId: string, brandUserId: string, boostAmount: number) {
    try {
      // Check if contest exists and belongs to the brand
      const contest = await AppDataSource.getRepository(Contest).findOne({
        where: { id: contestId, brand_id: brandUserId }
      });

      if (!contest) {
        return { success: false, error: 'Contest not found or you do not own this contest' };
      }

      // Check if contest is already boosted
      if (contest.is_boosted) {
        return { success: false, error: 'Contest is already boosted' };
      }

      // Get brand's wallet
      const wallet = await AppDataSource.getRepository(Wallet).findOne({
        where: { user_id: brandUserId }
      });

      if (!wallet) {
        return { success: false, error: 'Wallet not found' };
      }

      // Check if brand has enough balance
      if (wallet.balance < boostAmount) {
        return { success: false, error: 'Insufficient balance to boost contest' };
      }

      // Deduct boost amount from wallet
      wallet.balance -= boostAmount;
      await AppDataSource.getRepository(Wallet).save(wallet);

      // Update contest boost status
      contest.is_boosted = true;
      contest.boost_amount = boostAmount;
      await AppDataSource.getRepository(Contest).save(contest);

      // Create transaction record
      const transaction = new Transaction();
      transaction.wallet_id = wallet.id;
      transaction.user_id = brandUserId;
      transaction.amount = boostAmount;
      transaction.transaction_type = TransactionType.CONTEST_BOOST;
      transaction.status = TransactionStatus.COMPLETED;
      transaction.description = `Contest boost: ${contest.title}`;
      await AppDataSource.getRepository(Transaction).save(transaction);

      return { success: true, contest };
    } catch (error) {
      console.error('Boost contest error:', error);
      return { success: false, error: 'Failed to boost contest' };
    }
  }

  // Complete contest and select winners
  async completeContest(contestId: string, brandUserId: string) {
    try {
      // Get contest with submissions
      const contest = await AppDataSource.getRepository(Contest).findOne({
        where: { id: contestId, brand_id: brandUserId },
        relations: ['submissions', 'submissions.user']
      });

      if (!contest) {
        return { success: false, error: 'Contest not found or you do not own this contest' };
      }

      // Check if contest has ended
      const now = new Date();
      if (contest.end_date > now) {
        return { success: false, error: 'Contest has not ended yet' };
      }

      // Check if contest is already completed
      if (contest.status === ContestStatus.COMPLETED) {
        return { success: false, error: 'Contest is already completed' };
      }

      // Get all submissions with metrics
      const submissions = await AppDataSource.getRepository(ContestSubmission).find({
        where: { contest_id: contestId },
        relations: ['user'],
        order: { submitted_at: 'ASC' }
      });

      if (submissions.length === 0) {
        return { success: false, error: 'No submissions found for this contest' };
      }

      // Calculate scores based on judging method
      let scoredSubmissions = [];
      
      if (contest.judging_method === 'engagement') {
        scoredSubmissions = await this.calculateEngagementScores(submissions, contest.engagement_weights);
      } else {
        // For manual or hybrid judging, we'll need manual input
        // For now, we'll use engagement scores as fallback
        scoredSubmissions = await this.calculateEngagementScores(submissions, contest.engagement_weights);
      }

      // Sort by score (highest first)
      scoredSubmissions.sort((a, b) => b.score - a.score);

      // Select winners based on winner_count
      const winners = scoredSubmissions.slice(0, contest.winner_count || 1);

      // Update contest status
      contest.status = ContestStatus.COMPLETED;
      await AppDataSource.getRepository(Contest).save(contest);

      // Create winner records and distribute prizes
      const prizeDistribution = contest.prize_distribution || [{ place: 1, amount: contest.prize_pool, percentage: 100 }];
      
      for (let i = 0; i < winners.length; i++) {
        const winner = winners[i];
        const prizeInfo = prizeDistribution[i] || prizeDistribution[prizeDistribution.length - 1];
        
        // Get winner's wallet
        const winnerWallet = await AppDataSource.getRepository(Wallet).findOne({
          where: { user_id: winner.user_id }
        });

        if (winnerWallet) {
          // Add prize money to winner's wallet
          winnerWallet.balance += prizeInfo.amount;
          winnerWallet.total_earned += prizeInfo.amount; // Update total earnings
          await AppDataSource.getRepository(Wallet).save(winnerWallet);

          // Create transaction record
          const transaction = new Transaction();
          transaction.wallet_id = winnerWallet.id;
          transaction.user_id = winner.user_id;
          transaction.amount = prizeInfo.amount;
          transaction.transaction_type = TransactionType.CONTEST_PRIZE;
          transaction.status = TransactionStatus.COMPLETED;
          transaction.description = `Contest prize: ${contest.title} (${prizeInfo.place}${this.getOrdinalSuffix(prizeInfo.place)} place)`;
          await AppDataSource.getRepository(Transaction).save(transaction);
        }
      }

      return { 
        success: true, 
        contest, 
        winners: winners.map(w => ({
          submission: w,
          place: winners.indexOf(w) + 1,
          prize_amount: prizeDistribution[winners.indexOf(w)]?.amount || 0
        }))
      };
    } catch (error) {
      console.error('Complete contest error:', error);
      return { success: false, error: 'Failed to complete contest' };
    }
  }

  // Calculate engagement scores for submissions
  private async calculateEngagementScores(submissions: ContestSubmission[], weights: any) {
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

  // Helper function to get ordinal suffix
  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  // Get contest winners
  async getContestWinners(contestId: string) {
    try {
      const contest = await AppDataSource.getRepository(Contest).findOne({
        where: { id: contestId },
        relations: ['submissions', 'submissions.user']
      });

      if (!contest) {
        return { success: false, error: 'Contest not found' };
      }

      if (contest.status !== ContestStatus.COMPLETED) {
        return { success: false, error: 'Contest has not been completed yet' };
      }

      // Get submissions with scores (this would need to be stored in the database)
      const submissions = await AppDataSource.getRepository(ContestSubmission).find({
        where: { contest_id: contestId },
        relations: ['user'],
        order: { submitted_at: 'ASC' }
      });

      // Calculate scores again (in a real implementation, scores would be stored)
      const scoredSubmissions = await this.calculateEngagementScores(submissions, contest.engagement_weights);
      scoredSubmissions.sort((a, b) => b.score - a.score);

      const winners = scoredSubmissions.slice(0, contest.winner_count || 1);
      const prizeDistribution = contest.prize_distribution || [{ place: 1, amount: contest.prize_pool, percentage: 100 }];

      return {
        success: true,
        winners: winners.map((w, index) => ({
          submission: w,
          place: index + 1,
          prize_amount: prizeDistribution[index]?.amount || 0
        }))
      };
    } catch (error) {
      console.error('Get contest winners error:', error);
      return { success: false, error: 'Failed to get contest winners' };
    }
  }
}

export const contestService = new ContestService();