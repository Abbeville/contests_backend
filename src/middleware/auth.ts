import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { UserType } from '../types';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    user_type: UserType;
  };
  currentUser?: User;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log('Authenticating request...', token);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Helper function to get current user from database
export const getCurrentUser = async (req: AuthRequest): Promise<User | null> => {
  if (!req.user?.id) {
    return null;
  }

  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: req.user.id }
    });
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const authorize = (...userTypes: UserType[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not authenticated.'
      });
    }

    if (!userTypes.includes(req.user.user_type)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};