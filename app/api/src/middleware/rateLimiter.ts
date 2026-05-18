import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { redisClient } from '../index';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if logged in, otherwise use IP
    return req.user?.id || req.ip || 'unknown';
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

export { limiter as rateLimiter };

// Custom store using Redis
export class RedisStore {
  private prefix = 'rl:';
  
  async increment(key: string): Promise<{ total: number; resetTime: number }> {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const windowStart = now - windowMs;
    
    const multi = redisClient.multi();
    multi.zremrangebyscore(this.prefix + key, 0, windowStart);
    multi.zadd(this.prefix + key, now, now + '-' + Math.random());
    multi.zcard(this.prefix + key);
    multi.expire(this.prefix + key, Math.ceil(windowMs / 1000));
    
    const results = await multi.exec();
    const total = (results?.[2]?.[1] as number) || 0;
    
    return {
      total,
      resetTime: now + windowMs,
    };
  }

  async decrement(key: string): Promise<void> {
    await redisClient.decr(this.prefix + key);
  }

  async resetKey(key: string): Promise<void> {
    await redisClient.del(this.prefix + key);
  }
}