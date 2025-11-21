import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { Contest } from '../models/Contest';
import { ContestParticipant } from '../models/ContestParticipant';
import { ContestSubmission } from '../models/ContestSubmission';
import { Transaction } from '../models/Transaction';
import { Wallet } from '../models/Wallet';
import { SocialMediaAccount } from '../models/SocialMediaAccount';
import { SupportTicket } from '../models/SupportTicket';
import { SupportMessage } from '../models/SupportMessage';
import { Notification } from '../models/Notification';
import { UserType, ContestStatus, TransactionStatus, TransactionType, TicketStatus } from '../types';

export class AdminService {
  // Get dashboard statistics
  async getDashboardStats() {
    const [
      totalUsers,
      totalBrands,
      totalCreators,
      totalContests,
      activeContests,
      totalSubmissions,
      totalTransactions,
      totalRevenue,
      totalTickets,
      openTickets,
      totalSocialAccounts
    ] = await Promise.all([
      AppDataSource.getRepository(User).count(),
      AppDataSource.getRepository(User).count({ where: { user_type: UserType.BRAND } }),
      AppDataSource.getRepository(User).count({ where: { user_type: UserType.CREATOR } }),
      AppDataSource.getRepository(Contest).count(),
      AppDataSource.getRepository(Contest).count({ where: { status: ContestStatus.ACTIVE } }),
      AppDataSource.getRepository(ContestSubmission).count(),
      AppDataSource.getRepository(Transaction).count(),
      AppDataSource.getRepository(Transaction).sum('amount', {
        transaction_type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED
      }),
      AppDataSource.getRepository(SupportTicket).count(),
      AppDataSource.getRepository(SupportTicket).count({ where: { status: TicketStatus.OPEN } }),
      AppDataSource.getRepository(SocialMediaAccount).count()
    ]);

    return {
      users: {
        total: totalUsers,
        brands: totalBrands,
        creators: totalCreators
      },
      contests: {
        total: totalContests,
        active: activeContests,
        submissions: totalSubmissions
      },
      financial: {
        totalTransactions,
        totalRevenue: totalRevenue || 0
      },
      support: {
        totalTickets,
        openTickets
      },
      social: {
        totalAccounts: totalSocialAccounts
      }
    };
  }

  // Get user management data
  async getUsers(params: {
    page?: number;
    limit?: number;
    user_type?: string;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.wallet', 'wallet')
      .leftJoinAndSelect('user.socialMediaAccounts', 'socialMediaAccounts')
      .orderBy(`user.${params.sortBy || 'created_at'}`, params.sortOrder || 'DESC')
      .skip(skip)
      .take(limit);

    if (params.user_type) {
      queryBuilder.andWhere('user.user_type = :userType', { userType: params.user_type });
    }

    if (params.status) {
      queryBuilder.andWhere('user.status = :status', { status: params.status });
    }

    if (params.search) {
      queryBuilder.andWhere(
        '(user.username ILIKE :search OR user.email ILIKE :search OR user.first_name ILIKE :search OR user.last_name ILIKE :search)',
        { search: `%${params.search}%` }
      );
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Update user status
  async updateUserStatus(userId: string, status: 'active' | 'suspended' | 'banned') {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    (user as any).status = status;
    await AppDataSource.getRepository(User).save(user);

    return user;
  }

  // Delete user (soft delete)
  async deleteUser(userId: string) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    (user as any).status = 'deleted';
    await AppDataSource.getRepository(User).save(user);

    return { message: 'User deleted successfully' };
  }

  // Get contest management data
  async getContests(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(Contest)
      .createQueryBuilder('contest')
      .leftJoinAndSelect('contest.brand', 'brand')
      .leftJoinAndSelect('contest.participants', 'participants')
      .leftJoinAndSelect('contest.submissions', 'submissions')
      .orderBy(`contest.${params.sortBy || 'created_at'}`, params.sortOrder || 'DESC')
      .skip(skip)
      .take(limit);

    if (params.status) {
      queryBuilder.andWhere('contest.status = :status', { status: params.status });
    }

    if (params.type) {
      queryBuilder.andWhere('contest.contest_type = :type', { type: params.type });
    }

    if (params.search) {
      queryBuilder.andWhere(
        '(contest.title ILIKE :search OR contest.description ILIKE :search)',
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

  // Update contest status
  async updateContestStatus(contestId: string, status: ContestStatus) {
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id: contestId }
    });

    if (!contest) {
      throw new Error('Contest not found');
    }

    contest.status = status;
    await AppDataSource.getRepository(Contest).save(contest);

    return contest;
  }

  // Delete contest
  async deleteContest(contestId: string) {
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id: contestId }
    });

    if (!contest) {
      throw new Error('Contest not found');
    }

    await AppDataSource.getRepository(Contest).remove(contest);

    return { message: 'Contest deleted successfully' };
  }

  // Get financial data
  async getFinancialData(params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(Transaction)
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .leftJoinAndSelect('wallet.user', 'user')
      .orderBy('transaction.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.type) {
      queryBuilder.andWhere('transaction.transaction_type = :type', { type: params.type });
    }

    if (params.status) {
      queryBuilder.andWhere('transaction.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('transaction.created_at >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('transaction.created_at <= :endDate', { endDate: params.endDate });
    }

    const [transactions, total] = await queryBuilder.getManyAndCount();

    // Calculate financial summary
    const summary = await AppDataSource.getRepository(Transaction)
      .createQueryBuilder('transaction')
      .select([
        'transaction.transaction_type as type',
        'COUNT(*) as count',
        'SUM(transaction.amount) as total'
      ])
      .where('transaction.status = :status', { status: TransactionStatus.COMPLETED })
      .groupBy('transaction.transaction_type')
      .getRawMany();

    return {
      transactions,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get support tickets
  async getSupportTickets(params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(SupportTicket)
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .leftJoinAndSelect('ticket.messages', 'messages')
      .orderBy('ticket.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.status) {
      queryBuilder.andWhere('ticket.status = :status', { status: params.status });
    }

    if (params.priority) {
      queryBuilder.andWhere('ticket.priority = :priority', { priority: params.priority });
    }

    if (params.search) {
      queryBuilder.andWhere(
        '(ticket.subject ILIKE :search OR ticket.description ILIKE :search)',
        { search: `%${params.search}%` }
      );
    }

    const [tickets, total] = await queryBuilder.getManyAndCount();

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Update support ticket status
  async updateTicketStatus(ticketId: string, status: string) {
    const ticket = await AppDataSource.getRepository(SupportTicket).findOne({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    (ticket as any).status = status;
    await AppDataSource.getRepository(SupportTicket).save(ticket);

    return ticket;
  }

  // Get system analytics
  async getSystemAnalytics(params: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = params.endDate || new Date();

    // User registrations over time
    const userRegistrations = await AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .select('DATE(user.created_at) as date, COUNT(*) as count')
      .where('user.created_at >= :startDate', { startDate })
      .andWhere('user.created_at <= :endDate', { endDate })
      .groupBy('DATE(user.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Contest creations over time
    const contestCreations = await AppDataSource.getRepository(Contest)
      .createQueryBuilder('contest')
      .select('DATE(contest.created_at) as date, COUNT(*) as count')
      .where('contest.created_at >= :startDate', { startDate })
      .andWhere('contest.created_at <= :endDate', { endDate })
      .groupBy('DATE(contest.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Revenue over time
    const revenue = await AppDataSource.getRepository(Transaction)
      .createQueryBuilder('transaction')
      .select('DATE(transaction.created_at) as date, SUM(transaction.amount) as total')
      .where('transaction.created_at >= :startDate', { startDate })
      .andWhere('transaction.created_at <= :endDate', { endDate })
      .andWhere('transaction.status = :status', { status: TransactionStatus.COMPLETED })
      .groupBy('DATE(transaction.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      userRegistrations,
      contestCreations,
      revenue
    };
  }

  // Get platform health metrics
  async getPlatformHealth() {
    const [
      activeUsers,
      systemUptime,
      errorRate,
      responseTime
    ] = await Promise.all([
      AppDataSource.getRepository(User).count({ where: { is_active: true } }),
      // In a real app, you'd get this from monitoring system
      '99.9%',
      '0.1%',
      '150ms'
    ]);

    return {
      activeUsers,
      systemUptime,
      errorRate,
      responseTime
    };
  }

  // Send system notification
  async sendSystemNotification(notificationData: {
    title: string;
    message: string;
    type: string;
    targetUsers?: string[];
    targetUserType?: UserType;
  }) {
    const notification = new Notification();
    notification.title = notificationData.title;
    notification.message = notificationData.message;
    notification.type = notificationData.type;
    (notification as any).target_users = notificationData.targetUsers;
    (notification as any).target_user_type = notificationData.targetUserType;

    return await AppDataSource.getRepository(Notification).save(notification);
  }

  // Get admin activity log
  async getAdminActivityLog(params: {
    page?: number;
    limit?: number;
    adminId?: string;
    action?: string;
  }) {
    // In a real app, you'd have an admin activity log table
    // For now, we'll return a mock response
    return {
      activities: [],
      pagination: {
        page: params.page || 1,
        limit: params.limit || 10,
        total: 0,
        totalPages: 0
      }
    };
  }
}

export const adminService = new AdminService();