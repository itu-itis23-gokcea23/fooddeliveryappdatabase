import { Request, Response, NextFunction } from 'express';

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { roles?: string[] } | undefined;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const hasRole = roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

