import { AppDataSource } from '../config/database';
import { Wallet } from '../models/Wallet';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { Contest } from '../models/Contest';
import { ContestParticipant } from '../models/ContestParticipant';
import { ContestSubmission } from '../models/ContestSubmission';
import { TransactionType, TransactionStatus } from '../types';

export class WalletService {
  // Get wallet by user ID (create if doesn't exist)
  async getWalletByUserId(userId: string) {
    // First, verify the user exists
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    let wallet = await AppDataSource.getRepository(Wallet).findOne({
      where: { user_id: userId }
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await this.createWallet(userId);
    }

    return wallet;
  }

  // Create wallet for user
  async createWallet(userId: string) {
    // Check if wallet already exists
    const existingWallet = await AppDataSource.getRepository(Wallet).findOne({
      where: { user_id: userId }
    });

    if (existingWallet) {
      return existingWallet;
    }

    // Create new wallet
    const wallet = new Wallet();
    wallet.user_id = userId;
    wallet.balance = 0;
    wallet.currency = 'USD';

    return await AppDataSource.getRepository(Wallet).save(wallet);
  }

  // Get wallet transactions
  async getWalletTransactions(walletId: string, params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(Transaction)
      .createQueryBuilder('transaction')
      .where('transaction.wallet_id = :walletId', { walletId })
      .orderBy('transaction.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.type) {
      queryBuilder.andWhere('transaction.transaction_type = :type', { type: params.type });
    }

    if (params.status) {
      queryBuilder.andWhere('transaction.status = :status', { status: params.status });
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
  async addFunds(userId: string, amount: number, paymentMethod: string, metadata?: any) {
    const wallet = await this.getWalletByUserId(userId);

    // In a real application, you would integrate with a payment processor here
    // For now, we'll simulate a successful payment

    // Add funds to wallet
    wallet.balance += amount;
    // Track total deposited if column exists
    if (typeof (wallet as any).total_deposited === 'number') {
      (wallet as any).total_deposited += amount;
    }
    const savedWallet = await AppDataSource.getRepository(Wallet).save(wallet);

    // Create transaction record
    const transaction = new Transaction();
    transaction.wallet_id = wallet.id;
    transaction.user_id = userId; // Add the user_id field
    transaction.amount = amount;
    transaction.transaction_type = TransactionType.DEPOSIT;
    transaction.status = TransactionStatus.COMPLETED;
    transaction.description = `Deposit via ${paymentMethod}`;
    transaction.metadata = metadata || {};
    await AppDataSource.getRepository(Transaction).save(transaction);


    return {
      wallet: savedWallet,
      transaction
    };
  }

  // Withdraw funds from wallet
  async withdrawFunds(userId: string, amount: number, bankDetails: {
    account_number: string;
    bank_name: string;
    account_holder_name: string;
    routing_number?: string;
  }) {
    const wallet = await this.getWalletByUserId(userId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // In a real application, you would integrate with a payment processor here
    // For now, we'll just deduct the funds and mark as pending

    wallet.balance -= amount;
    await AppDataSource.getRepository(Wallet).save(wallet);

    // Create transaction record
    const transaction = new Transaction();
    transaction.wallet_id = wallet.id;
    transaction.user_id = userId; // Add missing user_id
    transaction.amount = amount;
    transaction.transaction_type = TransactionType.WITHDRAWAL;
    transaction.status = TransactionStatus.PENDING;
    transaction.description = `Withdrawal to ${bankDetails.bank_name} - ${bankDetails.account_number}`;
    transaction.metadata = bankDetails;
    await AppDataSource.getRepository(Transaction).save(transaction);

    return {
      wallet,
      transaction
    };
  }

  // Transfer funds between users
  async transferFunds(fromUserId: string, toUserId: string, amount: number, description?: string) {
    const fromWallet = await this.getWalletByUserId(fromUserId);
    const toWallet = await this.getWalletByUserId(toUserId);

    if (fromWallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct from sender
    fromWallet.balance -= amount;
    await AppDataSource.getRepository(Wallet).save(fromWallet);

    // Add to receiver
    toWallet.balance += amount;
    await AppDataSource.getRepository(Wallet).save(toWallet);

    // Create transaction records
    const fromTransaction = new Transaction();
    fromTransaction.wallet_id = fromWallet.id;
    fromTransaction.user_id = fromUserId; // Add missing user_id
    fromTransaction.amount = amount;
    fromTransaction.transaction_type = TransactionType.TRANSFER;
    fromTransaction.status = TransactionStatus.COMPLETED;
    fromTransaction.description = description || `Transfer to user ${toUserId}`;
    await AppDataSource.getRepository(Transaction).save(fromTransaction);

    const toTransaction = new Transaction();
    toTransaction.wallet_id = toWallet.id;
    toTransaction.user_id = toUserId; // Add missing user_id
    toTransaction.amount = amount;
    toTransaction.transaction_type = TransactionType.TRANSFER;
    toTransaction.status = TransactionStatus.COMPLETED;
    toTransaction.description = description || `Transfer from user ${fromUserId}`;
    await AppDataSource.getRepository(Transaction).save(toTransaction);

    return {
      fromWallet,
      toWallet,
      fromTransaction,
      toTransaction
    };
  }

  // Process contest prize payment
  async processContestPrize(contestId: string, winnerId: string, amount: number) {
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id: contestId }
    });

    if (!contest) {
      throw new Error('Contest not found');
    }

    const brandWallet = await this.getWalletByUserId(contest.brand_id);
    const winnerWallet = await this.getWalletByUserId(winnerId);

    // Check if brand has sufficient balance
    if (brandWallet.balance < amount) {
      throw new Error('Brand has insufficient balance for prize payment');
    }

    // Transfer prize from brand to winner
    const result = await this.transferFunds(
      contest.brand_id,
      winnerId,
      amount,
      `Contest prize for: ${contest.title}`
    );

    // Update contest submission as winner
    const submission = await AppDataSource.getRepository(ContestSubmission).findOne({
      where: { contest_id: contestId, user_id: winnerId }
    });

    if (submission) {
      submission.prize_amount = amount;
      await AppDataSource.getRepository(ContestSubmission).save(submission);
    }

    return result;
  }

  // Process contest entry fee
  async processContestEntryFee(contestId: string, participantId: string, entryFee: number) {
    const contest = await AppDataSource.getRepository(Contest).findOne({
      where: { id: contestId }
    });

    if (!contest) {
      throw new Error('Contest not found');
    }

    const participantWallet = await this.getWalletByUserId(participantId);
    const brandWallet = await this.getWalletByUserId(contest.brand_id);

    // Check if participant has sufficient balance
    if (participantWallet.balance < entryFee) {
      throw new Error('Insufficient balance for entry fee');
    }

    // Transfer entry fee from participant to brand
    const result = await this.transferFunds(
      participantId,
      contest.brand_id,
      entryFee,
      `Entry fee for contest: ${contest.title}`
    );

    return result;
  }

  // Get wallet statistics
  async getWalletStats(userId: string) {
    const wallet = await this.getWalletByUserId(userId);

    const [
      totalDeposits,
      totalWithdrawals,
      totalTransfersIn,
      totalTransfersOut,
      totalContestPrizes,
      totalContestFees
    ] = await Promise.all([
      AppDataSource.getRepository(Transaction).sum('amount', {
        wallet_id: wallet.id,
        transaction_type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED
      }),
      AppDataSource.getRepository(Transaction).sum('amount', {
        wallet_id: wallet.id,
        transaction_type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.COMPLETED
      }),
      AppDataSource.getRepository(Transaction).sum('amount', {
        wallet_id: wallet.id,
        transaction_type: TransactionType.TRANSFER,
        status: TransactionStatus.COMPLETED
      }),
      AppDataSource.getRepository(Transaction).sum('amount', {
        wallet_id: wallet.id,
        transaction_type: TransactionType.TRANSFER,
        status: TransactionStatus.COMPLETED
      }),
      AppDataSource.getRepository(Transaction).sum('amount', {
        wallet_id: wallet.id,
        transaction_type: TransactionType.CONTEST_PRIZE,
        status: TransactionStatus.COMPLETED
      }),
      AppDataSource.getRepository(Transaction).sum('amount', {
        wallet_id: wallet.id,
        transaction_type: TransactionType.CONTEST_CREATION,
        status: TransactionStatus.COMPLETED
      })
    ]);

    return {
      currentBalance: wallet.balance,
      totalDeposits: totalDeposits || 0,
      totalWithdrawals: totalWithdrawals || 0,
      totalTransfersIn: totalTransfersIn || 0,
      totalTransfersOut: totalTransfersOut || 0,
      totalContestPrizes: totalContestPrizes || 0,
      totalContestFees: totalContestFees || 0
    };
  }

  // Get transaction by ID
  async getTransactionById(transactionId: string) {
    const transaction = await AppDataSource.getRepository(Transaction).findOne({
      where: { id: transactionId },
      relations: ['wallet', 'wallet.user']
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  // Update transaction status
  async updateTransactionStatus(transactionId: string, status: TransactionStatus, metadata?: any) {
    const transaction = await this.getTransactionById(transactionId);

    transaction.status = status;
    if (metadata) {
      transaction.metadata = { ...transaction.metadata, ...metadata };
    }

    return await AppDataSource.getRepository(Transaction).save(transaction);
  }

  // Get all wallets (admin only)
  async getAllWallets(params: {
    page?: number;
    limit?: number;
    minBalance?: number;
    maxBalance?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(Wallet)
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.user', 'user')
      .orderBy('wallet.balance', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.minBalance !== undefined) {
      queryBuilder.andWhere('wallet.balance >= :minBalance', { minBalance: params.minBalance });
    }

    if (params.maxBalance !== undefined) {
      queryBuilder.andWhere('wallet.balance <= :maxBalance', { maxBalance: params.maxBalance });
    }

    const [wallets, total] = await queryBuilder.getManyAndCount();

    return {
      wallets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get all transactions (admin only)
  async getAllTransactions(params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    userId?: string;
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

    if (params.userId) {
      queryBuilder.andWhere('wallet.user_id = :userId', { userId: params.userId });
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
}

export const walletService = new WalletService();