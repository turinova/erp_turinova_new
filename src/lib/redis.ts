import { createClient } from 'redis'

// Redis client configuration
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    lazyConnect: true,
  },
})

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err)
})

redisClient.on('connect', () => {
  console.log('Redis Client Connected')
})

redisClient.on('ready', () => {
  console.log('Redis Client Ready')
})

redisClient.on('end', () => {
  console.log('Redis Client Disconnected')
})

// Connect to Redis
let isConnected = false
const connectRedis = async () => {
  if (!isConnected) {
    try {
      await redisClient.connect()
      isConnected = true
      console.log('Redis connected successfully')
    } catch (error) {
      console.error('Failed to connect to Redis:', error)
      // Fallback to in-memory cache if Redis is not available
      isConnected = false
    }
  }
}

// Initialize connection
connectRedis()

// Cache utility functions
export const redisCache = {
  // Get data from cache
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!isConnected) {
        await connectRedis()
      }
      
      const value = await redisClient.get(key)
      if (value) {
        console.log(`Redis cache hit for key: ${key}`)
        return JSON.parse(value as string)
      }
      return null
    } catch (error) {
      console.error('Redis get error:', error)
      return null
    }
  },

  // Set data in cache
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    try {
      if (!isConnected) {
        await connectRedis()
      }
      
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value))
      console.log(`Redis cache set for key: ${key} with TTL: ${ttlSeconds}s`)
    } catch (error) {
      console.error('Redis set error:', error)
    }
  },

  // Delete data from cache
  async del(key: string): Promise<void> {
    try {
      if (!isConnected) {
        await connectRedis()
      }
      
      await redisClient.del(key)
      console.log(`Redis cache deleted for key: ${key}`)
    } catch (error) {
      console.error('Redis delete error:', error)
    }
  },

  // Delete multiple keys matching pattern
  async delPattern(pattern: string): Promise<void> {
    try {
      if (!isConnected) {
        await connectRedis()
      }
      
      const keys = await redisClient.keys(pattern)
      if (keys.length > 0) {
        await redisClient.del(keys)
        console.log(`Redis cache deleted ${keys.length} keys matching pattern: ${pattern}`)
      }
    } catch (error) {
      console.error('Redis delete pattern error:', error)
    }
  },

  // Check if Redis is connected
  isConnected(): boolean {
    return isConnected
  }
}

export default redisClient
