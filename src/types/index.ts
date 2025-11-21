export enum UserType {
  CREATOR = 'creator',
  BRAND = 'brand',
  ADMIN = 'admin'
}

export enum ContestStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ContestType {
  PHOTO = 'photo',
  VIDEO = 'video',
  TEXT = 'text',
  MIXED = 'mixed'
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  CONTEST_PRIZE = 'contest_prize',
  CONTEST_CREATION = 'contest_creation',
  CONTEST_BOOST = 'contest_boost',
  PLATFORM_FEE = 'platform_fee',
  WITHDRAWAL_FEE = 'withdrawal_fee',
  TRANSFER = 'transfer'
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum SocialMediaPlatform {
  X = 'x',
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook'
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING_FOR_USER = 'waiting_for_user',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface User {
  id: string;
  email: string;
  username: string;
  user_type: UserType;
  is_verified: boolean;
  is_active: boolean;
  first_name?: string;
  last_name?: string;
  status?: 'active' | 'suspended' | 'banned' | 'deleted';
  created_at: Date;
  updated_at: Date;
  profile?: UserProfile;
  wallet?: Wallet;
}

export interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  bio?: string;
  avatar_url?: string;
  phone?: string;
  location?: string;
  website?: string;
  social_accounts?: SocialMediaAccount[];
  created_at: Date;
  updated_at: Date;
}

export interface Contest {
  id: string;
  title: string;
  description: string;
  brand_id: string;
  contest_type: ContestType;
  status: ContestStatus;
  prize_pool: number;
  entry_fee: number;
  start_date: Date;
  end_date: Date;
  submission_deadline: Date;
  max_participants?: number;
  requirements: string;
  judging_criteria: string;
  tags: string[];
  cover_image_url?: string;
  created_at: Date;
  updated_at: Date;
  brand?: User;
  participants?: ContestParticipant[];
  submissions?: ContestSubmission[];
}

export interface ContestParticipant {
  id: string;
  contest_id: string;
  user_id: string;
  joined_at: Date;
  user?: User;
  contest?: Contest;
}

export interface ContestSubmission {
  id: string;
  contest_id: string;
  user_id: string;
  post_url: string;
  post_content?: string;
  media_urls?: string[];
  status: string;
  submitted_at: Date;
  prize_amount?: number;
  reviewed_at?: Date;
  reviewed_by?: string;
  user?: User;
  contest?: Contest;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  user?: User;
  transactions?: Transaction[];
}

export interface Transaction {
  id: string;
  wallet_id: string;
  amount: number;
  transaction_type: TransactionType;
  status: TransactionStatus;
  description: string;
  reference?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
  wallet?: Wallet;
}

export interface SocialMediaAccount {
  id: string;
  user_id: string;
  platform: SocialMediaPlatform;
  platform_user_id: string;
  username: string;
  access_token: string;
  refresh_token?: string;
  profile_url?: string;
  follower_count?: number;
  verified?: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  user?: User;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  title?: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  attachments?: string[];
  resolution?: string;
  assigned_to?: string;
  created_at: Date;
  updated_at: Date;
  user?: User;
  messages?: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  sender_id?: string;
  message: string;
  is_admin: boolean;
  is_from_support?: boolean;
  attachments?: string[];
  created_at: Date;
  ticket?: SupportTicket;
  sender?: User;
}

export interface Notification {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  data?: any;
  target_users?: string[];
  target_user_type?: UserType;
  created_at: Date;
  user?: User;
}

// Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  user_type: UserType;
  first_name: string;
  last_name: string;
}

export interface CreateContestRequest {
  title: string;
  description: string;
  contest_type: ContestType;
  prize_pool: number;
  entry_fee: number;
  start_date: string;
  end_date: string;
  submission_deadline: string;
  max_participants?: number;
  requirements: string;
  judging_criteria: string;
  tags: string[];
  cover_image_url?: string;
}

export interface SubmitContestRequest {
  submission_url: string;
  title: string;
  description: string;
}

export interface WalletTransactionRequest {
  amount: number;
  transaction_type: TransactionType;
  description: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}