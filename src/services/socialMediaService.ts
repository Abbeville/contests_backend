import { AppDataSource } from '../config/database';
import { SocialMediaAccount } from '../models/SocialMediaAccount';
import { User } from '../models/User';

export class SocialMediaService {
  // Get user's social media accounts
  async getUserSocialAccounts(userId: string) {
    const accounts = await AppDataSource.getRepository(SocialMediaAccount).find({
      where: { user_id: userId },
      order: { created_at: 'DESC' }
    });

    return accounts;
  }

  // Connect social media account
  async connectSocialAccount(userId: string, socialData: {
    platform: string;
    platform_user_id?: string;
    username: string;
    access_token: string;
    refresh_token?: string;
    profile_url?: string;
    follower_count?: number;
    verified?: boolean;
  }) {
    // Check if account already exists for this platform
    const existingAccount = await AppDataSource.getRepository(SocialMediaAccount).findOne({
      where: { user_id: userId, platform: socialData.platform as any }
    });

    if (existingAccount) {
      // Update existing account
      Object.assign(existingAccount, socialData);
      existingAccount.updated_at = new Date();
      return await AppDataSource.getRepository(SocialMediaAccount).save(existingAccount);
    } else {
      // Create new account
      const socialAccount = new SocialMediaAccount();
      socialAccount.user_id = userId;
      Object.assign(socialAccount, socialData);
      // Ensure platform_user_id is set for non-nullable column
      if (!socialAccount.platform_user_id) {
        // Fallback to username if platform_user_id is unavailable (shouldn't happen for TikTok)
        socialAccount.platform_user_id = socialData.username;
      }
      return await AppDataSource.getRepository(SocialMediaAccount).save(socialAccount);
    }
  }

  // Disconnect social media account
  async disconnectSocialAccount(userId: string, platform: string) {
    const account = await AppDataSource.getRepository(SocialMediaAccount).findOne({
      where: { user_id: userId, platform: platform as any }
    });

    if (!account) {
      throw new Error('Social media account not found');
    }

    await AppDataSource.getRepository(SocialMediaAccount).remove(account);

    return { message: 'Social media account disconnected successfully' };
  }

  // Update social media account
  async updateSocialAccount(userId: string, platform: string, updateData: {
    username?: string;
    access_token?: string;
    refresh_token?: string;
    profile_url?: string;
    follower_count?: number;
    verified?: boolean;
  }) {
    const account = await AppDataSource.getRepository(SocialMediaAccount).findOne({
      where: { user_id: userId, platform: platform as any }
    });

    if (!account) {
      throw new Error('Social media account not found');
    }

    Object.assign(account, updateData);
    account.updated_at = new Date();

    return await AppDataSource.getRepository(SocialMediaAccount).save(account);
  }

  // Get social media account by ID
  async getSocialAccountById(accountId: string) {
    const account = await AppDataSource.getRepository(SocialMediaAccount).findOne({
      where: { id: accountId },
      relations: ['user']
    });

    if (!account) {
      throw new Error('Social media account not found');
    }

    return account;
  }

  // Get all social media accounts (admin only)
  async getAllSocialAccounts(params: {
    page?: number;
    limit?: number;
    platform?: string;
    verified?: boolean;
    userId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(SocialMediaAccount)
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.user', 'user')
      .orderBy('account.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.platform) {
      queryBuilder.andWhere('account.platform = :platform', { platform: params.platform });
    }

    if (params.verified !== undefined) {
      queryBuilder.andWhere('account.verified = :verified', { verified: params.verified });
    }

    if (params.userId) {
      queryBuilder.andWhere('account.user_id = :userId', { userId: params.userId });
    }

    const [accounts, total] = await queryBuilder.getManyAndCount();

    return {
      accounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get social media statistics
  async getSocialMediaStats(userId: string) {
    const accounts = await this.getUserSocialAccounts(userId);

    const stats = {
      totalAccounts: accounts.length,
      totalFollowers: accounts.reduce((sum, account) => sum + ((account as any).follower_count || 0), 0),
      verifiedAccounts: accounts.filter(account => (account as any).verified).length,
      platforms: accounts.map(account => account.platform)
    };

    return stats;
  }

  // Verify social media account (admin only)
  async verifySocialAccount(accountId: string, verified: boolean) {
    const account = await this.getSocialAccountById(accountId);

    (account as any).verified = verified;
    account.updated_at = new Date();

    return await AppDataSource.getRepository(SocialMediaAccount).save(account);
  }

  // Delete social media account (admin only)
  async deleteSocialAccount(accountId: string) {
    const account = await this.getSocialAccountById(accountId);

    await AppDataSource.getRepository(SocialMediaAccount).remove(account);

    return { message: 'Social media account deleted successfully' };
  }

  // Get platform-specific statistics
  async getPlatformStats(platform: string) {
    const accounts = await AppDataSource.getRepository(SocialMediaAccount).find({
      where: { platform: platform as any }
    });

    const stats = {
      totalAccounts: accounts.length,
      totalFollowers: accounts.reduce((sum, account) => sum + ((account as any).follower_count || 0), 0),
      verifiedAccounts: accounts.filter(account => (account as any).verified).length,
      averageFollowers: accounts.length > 0 
        ? Math.round(accounts.reduce((sum, account) => sum + ((account as any).follower_count || 0), 0) / accounts.length)
        : 0
    };

    return stats;
  }

  // Search social media accounts
  async searchSocialAccounts(params: {
    page?: number;
    limit?: number;
    search?: string;
    platform?: string;
    minFollowers?: number;
    maxFollowers?: number;
    verified?: boolean;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(SocialMediaAccount)
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.user', 'user')
      .orderBy('account.follower_count', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.search) {
      queryBuilder.andWhere(
        '(account.username ILIKE :search OR user.username ILIKE :search OR user.first_name ILIKE :search OR user.last_name ILIKE :search)',
        { search: `%${params.search}%` }
      );
    }

    if (params.platform) {
      queryBuilder.andWhere('account.platform = :platform', { platform: params.platform });
    }

    if (params.minFollowers !== undefined) {
      queryBuilder.andWhere('account.follower_count >= :minFollowers', { minFollowers: params.minFollowers });
    }

    if (params.maxFollowers !== undefined) {
      queryBuilder.andWhere('account.follower_count <= :maxFollowers', { maxFollowers: params.maxFollowers });
    }

    if (params.verified !== undefined) {
      queryBuilder.andWhere('account.verified = :verified', { verified: params.verified });
    }

    const [accounts, total] = await queryBuilder.getManyAndCount();

    return {
      accounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

export const socialMediaService = new SocialMediaService();