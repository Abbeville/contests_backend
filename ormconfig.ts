import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/models/User';
import { UserProfile } from './src/models/UserProfile';
import { Contest } from './src/models/Contest';
import { ContestParticipant } from './src/models/ContestParticipant';
import { ContestSubmission } from './src/models/ContestSubmission';
import { Wallet } from './src/models/Wallet';
import { Transaction } from './src/models/Transaction';
import { SocialMediaAccount } from './src/models/SocialMediaAccount';
import { SupportTicket } from './src/models/SupportTicket';
import { SupportMessage } from './src/models/SupportMessage';
import { Notification } from './src/models/Notification';

config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'contests',
  synchronize: false, // Disable synchronize for migrations
  logging: process.env.NODE_ENV === 'development',
  entities: [
    User,
    UserProfile,
    Contest,
    ContestParticipant,
    ContestSubmission,
    Wallet,
    Transaction,
    SocialMediaAccount,
    SupportTicket,
    SupportMessage,
    Notification
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts']
});
