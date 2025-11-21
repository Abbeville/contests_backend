import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { Wallet } from '../models/Wallet';
import { Transaction } from '../models/Transaction';
import { SocialMediaAccount } from '../models/SocialMediaAccount';
import { Contest } from '../models/Contest';
import { ContestParticipant } from '../models/ContestParticipant';
import { ContestSubmission } from '../models/ContestSubmission';
import { UserType, TransactionType, TransactionStatus } from '../types';
import { MoreThan } from 'typeorm';
import bcrypt from 'bcryptjs';

export class UserService {
  // Get user profile with all related data
  async getUserProfile(userId: string) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      relations: ['profile', 'wallet', 'social_accounts']
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  // Update user profile
  async updateUserProfile(userId: string, profileData: {
    first_name?: string;
    last_name?: string;
    bio?: string;
    location?: string;
    website?: string;
    profile_image_url?: string;
    phone?: string;
    date_of_birth?: Date;
    gender?: string;
    interests?: string[];
  }) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      relations: ['profile']
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Update user basic info
    if (profileData.first_name) (user as any).first_name = profileData.first_name;
    if (profileData.last_name) (user as any).last_name = profileData.last_name;

    await AppDataSource.getRepository(User).save(user);

    // Update or create profile
    let profile = user.profile;
    if (!profile) {
      profile = new UserProfile();
      profile.user_id = userId;
    }

    Object.assign(profile, profileData);
    await AppDataSource.getRepository(UserProfile).save(profile);

    return await this.getUserProfile(userId);
  }

  // Update user password
  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedNewPassword;

    await AppDataSource.getRepository(User).save(user);

    return { message: 'Password updated successfully' };
  }

  // Get user wallet
  async getUserWallet(userId: string) {
    const wallet = await AppDataSource.getRepository(Wallet).findOne({
      where: { user_id: userId }
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return wallet;
  }

  // Get user transactions
  async getUserTransactions(userId: string, params: {
    page?: number;
    limit?: number;
    type?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const wallet = await this.getUserWallet(userId);

    const queryBuilder = AppDataSource.getRepository(Transaction)
      .createQueryBuilder('transaction')
      .where('transaction.wallet_id = :walletId', { walletId: wallet.id })
      .orderBy('transaction.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.type) {
      queryBuilder.andWhere('transaction.transaction_type = :type', { type: params.type });
    }

    const [transactions, total] = await queryBuilder.getManyAndCount();

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Add funds to wallet
  async addFunds(userId: string, amount: number, paymentMethod: string) {
    const wallet = await this.getUserWallet(userId);

    // In a real app, you would integrate with a payment processor here
    // For now, we'll just add the funds directly

    wallet.balance += amount;
    await AppDataSource.getRepository(Wallet).save(wallet);

    // Create transaction record
    const transaction = new Transaction();
    transaction.wallet_id = wallet.id;
    transaction.amount = amount;
    transaction.transaction_type = TransactionType.DEPOSIT;
    transaction.status = TransactionStatus.COMPLETED;
    transaction.description = `Deposit via ${paymentMethod}`;
    await AppDataSource.getRepository(Transaction).save(transaction);

    return wallet;
  }

  // Withdraw funds from wallet
  async withdrawFunds(userId: string, amount: number, bankDetails: {
    account_number: string;
    bank_name: string;
    account_holder_name: string;
  }) {
    const wallet = await this.getUserWallet(userId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    wallet.balance -= amount;
    await AppDataSource.getRepository(Wallet).save(wallet);

    // Create transaction record
    const transaction = new Transaction();
    transaction.wallet_id = wallet.id;
    transaction.amount = amount;
    transaction.transaction_type = TransactionType.WITHDRAWAL;
    transaction.status = TransactionStatus.PENDING; // In real app, this would be processed by payment processor
    transaction.description = `Withdrawal to ${bankDetails.bank_name} - ${bankDetails.account_number}`;
    await AppDataSource.getRepository(Transaction).save(transaction);

    return wallet;
  }

  // Connect social media account
  async connectSocialMedia(userId: string, socialData: {
    platform: string;
    username: string;
    access_token: string;
    refresh_token?: string;
    profile_url?: string;
    follower_count?: number;
  }) {
    // Check if account already exists
    const existingAccount = await AppDataSource.getRepository(SocialMediaAccount).findOne({
      where: { user_id: userId, platform: socialData.platform as any }
    });

    if (existingAccount) {
      // Update existing account
      Object.assign(existingAccount, socialData);
      return await AppDataSource.getRepository(SocialMediaAccount).save(existingAccount);
    } else {
      // Create new account
      const socialAccount = new SocialMediaAccount();
      socialAccount.user_id = userId;
      Object.assign(socialAccount, socialData);
      return await AppDataSource.getRepository(SocialMediaAccount).save(socialAccount);
    }
  }

  // Disconnect social media account
  async disconnectSocialMedia(userId: string, platform: string) {
    const account = await AppDataSource.getRepository(SocialMediaAccount).findOne({
      where: { user_id: userId, platform: platform as any }
    });

    if (!account) {
      throw new Error('Social media account not found');
    }

    await AppDataSource.getRepository(SocialMediaAccount).remove(account);

    return { message: 'Social media account disconnected successfully' };
  }

  // Get user statistics
  async getUserStats(userId: string) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const stats: any = {};

    if (user.user_type === UserType.CREATOR) {
      // Creator stats
      const [contestParticipations, contestSubmissions, contestWins] = await Promise.all([
        AppDataSource.getRepository(ContestParticipant).count({
          where: { user_id: userId }
        }),
        AppDataSource.getRepository(ContestSubmission).count({
          where: { user_id: userId }
        }),
        AppDataSource.getRepository(ContestSubmission).count({
          where: { user_id: userId, prize_amount: MoreThan(0) }
        })
      ]);

      stats.contestParticipations = contestParticipations;
      stats.contestSubmissions = contestSubmissions;
      stats.contestWins = contestWins;
    } else if (user.user_type === UserType.BRAND) {
      // Brand stats
      const [contestsCreated, totalParticipants, totalSubmissions] = await Promise.all([
        AppDataSource.getRepository(Contest).count({
          where: { brand_id: userId }
        }),
        AppDataSource.getRepository(ContestParticipant)
          .createQueryBuilder('participant')
          .leftJoin('participant.contest', 'contest')
          .where('contest.brand_id = :userId', { userId })
          .getCount(),
        AppDataSource.getRepository(ContestSubmission)
          .createQueryBuilder('submission')
          .leftJoin('submission.contest', 'contest')
          .where('contest.brand_id = :userId', { userId })
          .getCount()
      ]);

      stats.contestsCreated = contestsCreated;
      stats.totalParticipants = totalParticipants;
      stats.totalSubmissions = totalSubmissions;
    }

    return stats;
  }

  // Get all users (admin only)
  async getAllUsers(params: {
    page?: number;
    limit?: number;
    user_type?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.wallet', 'wallet')
      .orderBy('user.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.user_type) {
      queryBuilder.andWhere('user.user_type = :userType', { userType: params.user_type });
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

  // Update user status (admin only)
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

  // Delete user (admin only)
  async deleteUser(userId: string) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Soft delete - just mark as deleted
    (user as any).status = 'deleted';
    await AppDataSource.getRepository(User).save(user);

    return { message: 'User deleted successfully' };
  }
}

export const userService = new UserService();