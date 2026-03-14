const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection
let db = null;
let currentDbPath = null;

/**
 * Get the database file path
 */
function getDbPath() {
    if (process.env.TEST_MODE === 'true') {
        return process.env.TEST_DB_PATH || path.join(__dirname, 'test_social_media.db');
    }
    return path.join(__dirname, 'social_media.db');
}

/**
 * Initialize the SQLite database and create the post_history table if it doesn't exist
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const dbPath = getDbPath();
        currentDbPath = dbPath;
        
        // Create or open database
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('✗ Failed to connect to database:', err.message);
                return reject(err);
            }
            
            console.log('→ Initializing database...');
            
            // Create post_history table with schema
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS post_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_date TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    format TEXT NOT NULL,
                    topic TEXT,
                    caption TEXT,
                    media_prompt TEXT,
                    media_url TEXT,
                    likes INTEGER DEFAULT 0,
                    reach INTEGER DEFAULT 0,
                    ai_analysis TEXT,
                    status TEXT NOT NULL
                )
            `;
            
            db.run(createTableSQL, (err) => {
                if (err) {
                    console.error('✗ Failed to create post_history table:', err.message);
                    return reject(err);
                }

                // Add media_prompt column if it doesn't exist (migration for existing DBs)
                db.run(`ALTER TABLE post_history ADD COLUMN media_prompt TEXT`, (alterErr) => {
                    // Ignore error — column already exists
                    console.log('✓ Database initialized successfully');
                    resolve();
                });
            });
        });
    });
}

/**
 * Get the database connection
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}

/**
 * Close the database connection
 */
async function closeDatabase() {
    return new Promise((resolve) => {
        if (!db) {
            return resolve();
        }

        // Give any in-flight async DB callbacks a tick to complete
        setImmediate(() => {
            db.close((err) => {
                if (err) {
                    console.error('✗ Error closing database:', err.message);
                }  else {
                    console.log('✓ Database connection closed');
                }
                db = null;
                resolve();
            });
        });
    });
}

/**
 * Retrieve posts from the last N days with status 'published'
 * Requirements: 2.1, 2.2, 2.3, 2.4
 * 
 * @param {number} days - Number of days to look back (default: 7)
 * @returns {Promise<Array>} Array of published posts with all columns
 */
async function getHistoricalPosts(days = 7) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database not initialized. Call initializeDatabase() first.'));
        }
        
        // Calculate the date N days ago
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        
        console.log(`→ Retrieving historical posts from last ${days} days (since ${cutoffDateStr})...`);
        
        // Query for published posts from the last N days
        const querySQL = `
            SELECT * FROM post_history
            WHERE status = 'published'
            AND target_date >= ?
            ORDER BY target_date DESC
        `;
        
        db.all(querySQL, [cutoffDateStr], (err, rows) => {
            if (err) {
                console.error('✗ Failed to retrieve historical posts:', err.message);
                return reject(err);
            }
            
            // Handle empty result case
            const posts = rows || [];
            console.log(`✓ Retrieved ${posts.length} historical post(s)`);
            
            resolve(posts);
        });
    });
}

/**
 * Insert a new content plan into the database
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * 
 * @param {Object} plan - Content plan object with format, topic, caption, media_prompt, ai_analysis
 * @returns {Promise<number>} The inserted record ID
 */
async function insertContentPlan(plan) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database not initialized. Call initializeDatabase() first.'));
        }
        
        // Calculate tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const targetDate = tomorrow.toISOString().split('T')[0];
        
        // Derive platform from format
        // posts and stories → 'both', reels → 'instagram'
        const platform = plan.format === 'reel' ? 'instagram' : 'both';
        
        console.log(`→ Inserting content plan for ${targetDate} (${plan.format} on ${platform})...`);
        
        // Insert the content plan with status 'planned'
        const insertSQL = `
            INSERT INTO post_history 
            (target_date, platform, format, topic, caption, media_prompt, ai_analysis, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(
            insertSQL,
            [
                targetDate,
                platform,
                plan.format,
                plan.topic,
                plan.caption,
                plan.media_prompt || null,
                plan.ai_analysis,
                'planned'
            ],
            function(err) {
                if (err) {
                    console.error('✗ Failed to insert content plan:', err.message);
                    return reject(err);
                }
                
                const insertedId = this.lastID;
                console.log(`✓ Content plan saved with ID ${insertedId}`);
                
                resolve(insertedId);
            }
        );
    });
}

/**
 * Update post status after publishing
 * Requirements: 8.1, 8.2, 8.3, 8.4
 * 
 * @param {number} id - Post record ID
 * @param {string} status - New status ('published' or 'failed')
 * @param {string} errorDetails - Error details if status is 'failed' (optional)
 * @returns {Promise<void>}
 */
async function updatePostStatus(id, status, errorDetails = null) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database not initialized. Call initializeDatabase() first.'));
        }
        
        console.log(`→ Updating post ${id} status to '${status}'...`);
        
        const updateSQL = `
            UPDATE post_history
            SET status = ?
            WHERE id = ?
        `;
        
        db.run(updateSQL, [status, id], function(err) {
            if (err) {
                console.error(`✗ Failed to update post ${id} status:`, err.message);
                return reject(err);
            }
            
            if (status === 'failed' && errorDetails) {
                console.log(`✓ Post ${id} status updated to '${status}' - Error: ${errorDetails}`);
            } else {
                console.log(`✓ Post ${id} status updated to '${status}'`);
            }
            
            resolve();
        });
    });
}

/**
 * Update post metrics from analytics
 * Requirements: 9.3, 9.4
 * 
 * @param {number} id - Post record ID
 * @param {number} likes - Number of likes
 * @param {number} reach - Number of reach
 * @returns {Promise<void>}
 */
async function updatePostMetrics(id, likes, reach) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database not initialized. Call initializeDatabase() first.'));
        }
        
        console.log(`→ Updating post ${id} metrics (likes: ${likes}, reach: ${reach})...`);
        
        const updateSQL = `
            UPDATE post_history
            SET likes = ?, reach = ?
            WHERE id = ?
        `;
        
        db.run(updateSQL, [likes, reach, id], function(err) {
            if (err) {
                console.error(`✗ Failed to update post ${id} metrics:`, err.message);
                return reject(err);
            }
            
            console.log(`✓ Post ${id} metrics updated (likes: ${likes}, reach: ${reach})`);
            
            resolve();
        });
    });
}

/**
 * Retrieve today's planned post
 * Requirements: 8.1, 8.2, 8.3, 8.4
 * 
 * @returns {Promise<Object|null>} Today's planned post or null if not found
 */
async function getTodaysPlannedPost() {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database not initialized. Call initializeDatabase() first.'));
        }
        
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        
        console.log(`→ Retrieving today's planned post (${today})...`);
        
        const querySQL = `
            SELECT * FROM post_history
            WHERE status = 'planned'
            AND target_date = ?
            LIMIT 1
        `;
        
        db.get(querySQL, [today], (err, row) => {
            if (err) {
                console.error('✗ Failed to retrieve today\'s planned post:', err.message);
                return reject(err);
            }
            
            if (row) {
                console.log(`✓ Retrieved planned post with ID ${row.id}`);
            } else {
                console.log('✓ No planned post found for today');
            }
            
            resolve(row || null);
        });
    });
}

/**
 * Get topics from recent posts to avoid content duplication
 * 
 * @param {number} days - Number of days to look back (default: 14)
 * @returns {Promise<Array<string>>} Array of recent topic strings
 */
async function getRecentTopics(days = 14) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database not initialized. Call initializeDatabase() first.'));
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        const querySQL = `
            SELECT topic FROM post_history
            WHERE topic IS NOT NULL
            AND target_date >= ?
            ORDER BY target_date DESC
        `;

        db.all(querySQL, [cutoffDateStr], (err, rows) => {
            if (err) {
                console.error('✗ Failed to retrieve recent topics:', err.message);
                return reject(err);
            }
            const topics = (rows || []).map(r => r.topic).filter(Boolean);
            console.log(`✓ Retrieved ${topics.length} recent topic(s) for duplicate check`);
            resolve(topics);
        });
    });
}

module.exports = {
    initializeDatabase,
    getDatabase,
    closeDatabase,
    getHistoricalPosts,
    getRecentTopics,
    insertContentPlan,
    updatePostStatus,
    updatePostMetrics,
    getTodaysPlannedPost
};
