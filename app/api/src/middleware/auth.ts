import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError } from './errorHandler';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    schoolId: string;
    roleId: string;
    permissions: string[];
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      userId: string;
      email: string;
      schoolId: string;
      roleId: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user || !user.is_active) {
      throw new AppError('User not found or inactive', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      schoolId: user.school_id,
      roleId: user.role_id,
      permissions: user.role.permissions as string[],
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', 401);
    }
    next(error);
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }
    
    // Super admin has all permissions
    if (req.user.permissions.includes('*')) {
      return next();
    }
    
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.roleId)) {
      throw new AppError('Not authorized to access this resource', 403);
    }
    
    next();
  };
};

export const checkPermission = (...requiredPermissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }
    
    // Super admin has all permissions
    if (req.user.permissions.includes('*')) {
      return next();
    }
    
    const hasAllPermissions = requiredPermissions.every((perm) =>
      req.user!.permissions.includes(perm)
    );
    
    if (!hasAllPermissions) {
      throw new AppError('Missing required permissions', 403);
    }
    
    next();
  };
};

export const schoolAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }
  
  const schoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId;
  
  if (schoolId && schoolId !== req.user.schoolId) {
    // Check if user is super admin (can access all schools)
    if (!req.user.permissions.includes('*')) {
      throw new AppError('Not authorized to access this school', 403);
    }
  }
  
  next();
};