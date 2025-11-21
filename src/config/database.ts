import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { Contest } from '../models/Contest';
import { ContestParticipant } from '../models/ContestParticipant';
import { ContestSubmission } from '../models/ContestSubmission';
import { SubmissionMetrics } from '../models/SubmissionMetrics'; // Temporarily commented out for migration
import { Wallet } from '../models/Wallet';
import { Transaction } from '../models/Transaction';
import { SocialMediaAccount } from '../models/SocialMediaAccount';
import { SupportTicket } from '../models/SupportTicket';
import { SupportMessage } from '../models/SupportMessage';
import { Notification } from '../models/Notification';
import { BankAccount } from '../models/BankAccount';
import { Withdrawal } from '../models/Withdrawal';
import { WalletLedger } from '../models/WalletLedger';

config();

const isDev = process.env.NODE_ENV === 'development';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'contests',
  synchronize: process.env.NODE_ENV === 'true',
  logging: process.env.NODE_ENV === 'true',
  entities: [
    User,
    UserProfile,
    Contest,
    ContestParticipant,
    ContestSubmission,
    SubmissionMetrics, // Temporarily commented out for migration
    Wallet,
    Transaction,
    SocialMediaAccount,
    SupportTicket,
    SupportMessage,
    Notification,
    BankAccount,
    Withdrawal
    ,WalletLedger
  ],
  migrations: [isDev ? 'src/migrations/*.ts' : 'dist/migrations/*.js'],
  subscribers: [isDev ? 'src/subscribers/*.ts' : 'dist/subscribers/*.js']
});

export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully', `host: ${process.env.DB_HOST}, port: ${process.env.DB_PORT}, username: ${process.env.DB_USER}, password: ${process.env.DB_PASSWORD}, database: ${process.env.DB_NAME}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};