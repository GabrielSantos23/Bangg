// Dynamic import to avoid loading pg in browser
let pgModule: any = null;

async function getPgModule() {
  if (typeof window !== "undefined") {
    return null;
  }
  if (!pgModule) {
    // Dynamic import - pg is marked as external in vite.config.ts
    // so Node.js will load it natively as CommonJS
    const pgImport = await import("pg");
    // pg can export as default or named, handle both
    pgModule = pgImport.default || pgImport;
    // Ensure Pool is available
    if (!pgModule.Pool) {
      pgModule = pgModule.default || pgModule;
    }
  }
  return pgModule;
}

let pool: any;

// Wrapper to make pg compatible with Neon's API (which returns rows directly)
type Queryable = {
  query<T = any>(text: string, params?: any[]): Promise<T[]>;
};

function createQueryable(pool: any): Queryable {
  return {
    async query<T = any>(text: string, params?: any[]): Promise<T[]> {
      const startTime = Date.now();
      try {
        // Log pool status before query if pool is under stress
        if (pool.waitingCount > 0 || pool.idleCount === 0) {
          console.warn("Pool under stress before query:", {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
            query: text.substring(0, 50) + "...",
          });
        }

        const result = await pool.query(text, params);
        const duration = Date.now() - startTime;
        
        // Log slow queries (> 1 second)
        if (duration > 1000) {
          console.warn("Slow query detected:", {
            duration: `${duration}ms`,
            query: text.substring(0, 50) + "...",
          });
        }

        return result.rows;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        // Log pool status for debugging
        if (error.code === "ETIMEDOUT" || error.message?.includes("timeout") || error.message?.includes("timed out")) {
          console.error("Database query timeout:", {
            duration: `${duration}ms`,
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
            query: text.substring(0, 100),
            error: error.message,
          });
        } else {
          console.error("Database query error:", {
            duration: `${duration}ms`,
            error: error.message,
            code: error.code,
            query: text.substring(0, 50) + "...",
          });
        }
        throw error;
      }
    },
  };
}

// Initialize and warm up the pool
let poolInitializationPromise: Promise<void> | null = null;

async function initializePool(): Promise<void> {
  if (!process.env.VITE_DATABASE_URL) {
    return;
  }
  if (pool) {
    return;
  }

  const pg = await getPgModule();
  if (!pg) {
    throw new Error("pg module not available (client-side)");
  }

  const databaseUrl = process.env.VITE_DATABASE_URL || "";
  const isSupabase = databaseUrl.includes("supabase");
  const isNeon = databaseUrl.includes("neon");
  // Check if SSL is required (either by provider or explicit sslmode parameter)
  const hasSslMode = databaseUrl.includes("sslmode=require") || databaseUrl.includes("sslmode=prefer");
  const requiresSSL = isSupabase || isNeon || hasSslMode;

  // Remove sslmode from connection string to avoid conflicts with ssl config
  // We'll handle SSL via the ssl config option instead
  let cleanConnectionString = databaseUrl;
  if (hasSslMode) {
    cleanConnectionString = databaseUrl
      .replace(/[?&]sslmode=require/gi, "")
      .replace(/[?&]sslmode=prefer/gi, "")
      .replace(/[?&]sslmode=disable/gi, "");
    // Clean up any trailing ? or & after removal
    cleanConnectionString = cleanConnectionString.replace(/[?&]$/, "");
  }

  // SSL configuration - rejectUnauthorized: false for self-signed certificates
  // This is safe for development but should be configured properly in production
  const sslConfig = requiresSSL
    ? {
        rejectUnauthorized: false, // Allow self-signed certificates
      }
    : undefined;

  if (requiresSSL) {
    console.log("Database SSL enabled (rejectUnauthorized: false)");
  }

  const newPool = new pg.Pool({
    connectionString: cleanConnectionString,
    // Connection pool settings - increased for better concurrency
    max: 30, // Maximum number of clients in the pool (increased from 20)
    min: 5, // Minimum number of clients in the pool (increased from 2)
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 30000, // Return an error after 30 seconds (increased from 10s)
    // Allow pool to wait longer for connections
    allowExitOnIdle: false, // Keep pool alive even when idle

    // SSL configuration - this will be used instead of sslmode in connection string
    ssl: sslConfig,
  });

  // Handle pool errors
  newPool.on("error", (err: Error) => {
    console.error("Unexpected error on idle client", err);
  });

  // Handle connection events for debugging
  newPool.on("connect", () => {
    console.log("Database connection established", {
      totalCount: newPool.totalCount,
      idleCount: newPool.idleCount,
      waitingCount: newPool.waitingCount,
    });
  });

  newPool.on("acquire", () => {
    if (newPool.waitingCount > 0) {
      console.warn("Pool has waiting clients:", {
        totalCount: newPool.totalCount,
        idleCount: newPool.idleCount,
        waitingCount: newPool.waitingCount,
      });
    }
  });

  pool = newPool;

  // Warm up the pool by creating initial connections
  try {
    console.log("Warming up database pool...");
    const warmupPromises: Promise<void>[] = [];
    // Warm up with min connections (5)
    for (let i = 0; i < 5; i++) {
      warmupPromises.push(
        newPool.query("SELECT 1").then(() => {
          console.log(`Pool connection ${i + 1} warmed up`);
        }).catch((err) => {
          console.warn(`Pool connection ${i + 1} warmup failed:`, err.message);
        })
      );
    }
    await Promise.all(warmupPromises);
    console.log("Database pool warmed up successfully", {
      totalCount: newPool.totalCount,
      idleCount: newPool.idleCount,
    });
  } catch (error) {
    console.error("Failed to warm up pool:", error);
    // Don't throw - pool is still usable, just not pre-warmed
  }
}

export async function getClient(): Promise<Queryable | undefined> {
  // Only work on server-side (Node.js environment)
  if (typeof window !== "undefined") {
    console.warn(
      "getClient() called on client-side. Database operations should only run on the server."
    );
    return undefined;
  }

  if (!process.env.VITE_DATABASE_URL) {
    return undefined;
  }

  // Initialize pool if not already initialized
  if (!pool) {
    if (!poolInitializationPromise) {
      poolInitializationPromise = initializePool();
    }
    await poolInitializationPromise;
  }

  if (!pool) {
    return undefined;
  }

  return createQueryable(pool);
}

// Function to close the pool (useful for cleanup in tests or shutdown)
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    poolInitializationPromise = null;
  }
}
