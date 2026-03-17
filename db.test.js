const fc = require('fast-check');
const { initializeDatabase, getDatabase, closeDatabase, getHistoricalPosts, insertContentPlan, updatePostStatus, updatePostMetrics } = require('./db');
const fs = require('fs');
const path = require('path');

/**
 * Utility to get local YYYY-MM-DD string
 */
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Test database path - will be unique per test
let TEST_DB_PATH;

describe('Database Module - Property Tests', () => {
    beforeEach(async () => {
        // Create unique test database path
        TEST_DB_PATH = path.join(__dirname, `test_social_media_${Date.now()}_${Math.random()}.db`);
        
        // Override DB_PATH for testing
        process.env.TEST_MODE = 'true';
        process.env.TEST_DB_PATH = TEST_DB_PATH;
        
        // Initialize fresh database
        await initializeDatabase();
    });

    afterEach(async () => {
        // Close database connection
        await closeDatabase();
        
        // Clean up test database
        if (fs.existsSync(TEST_DB_PATH)) {
            try {
                fs.unlinkSync(TEST_DB_PATH);
            } catch (err) {
                // Ignore cleanup errors
            }
        }
    });

    /**
     * Property 1: Default Metrics Initialization
     * Validates: Requirements 1.3
     * 
     * For any new post record inserted without explicit likes and reach values,
     * those fields should default to 0.
     */
    test('Feature: ai-social-media-manager, Property 1: Default metrics initialization', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    target_date: fc.date().map(d => getLocalDateString(d)),
                    platform: fc.constantFrom('facebook', 'instagram', 'both'),
                    format: fc.constantFrom('post', 'reel', 'story'),
                    topic: fc.string({ minLength: 1, maxLength: 100 }),
                    caption: fc.string({ minLength: 1, maxLength: 500 }),
                    media_url: fc.option(fc.webUrl(), { nil: null }),
                    ai_analysis: fc.string({ minLength: 1, maxLength: 200 }),
                    status: fc.constantFrom('planned', 'published', 'failed')
                }),
                async (postData) => {
                    const db = getDatabase();
                    
                    // Insert post without specifying likes and reach
                    const insertSQL = `
                        INSERT INTO post_history 
                        (target_date, platform, format, topic, caption, media_url, ai_analysis, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    return new Promise((resolve, reject) => {
                        db.run(
                            insertSQL,
                            [
                                postData.target_date,
                                postData.platform,
                                postData.format,
                                postData.topic,
                                postData.caption,
                                postData.media_url,
                                postData.ai_analysis,
                                postData.status
                            ],
                            function(err) {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                
                                const insertedId = this.lastID;
                                
                                // Retrieve the inserted record
                                db.get(
                                    'SELECT * FROM post_history WHERE id = ?',
                                    [insertedId],
                                    (err, record) => {
                                        if (err) {
                                            reject(err);
                                            return;
                                        }
                                        
                                        // Verify likes and reach default to 0
                                        try {
                                            expect(record.likes).toBe(0);
                                            expect(record.reach).toBe(0);
                                            resolve();
                                        } catch (assertionError) {
                                            reject(assertionError);
                                        }
                                    }
                                );
                            }
                        );
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 2: Historical Query Filtering
     * Validates: Requirements 2.1
     * 
     * For any database state with various posts at different dates and statuses,
     * querying historical posts should return only those with status 'published'
     * from the last 7 days.
     */
    test('Feature: ai-social-media-manager, Property 2: Historical query filtering', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        target_date: fc.integer({ min: 0, max: 365 }).map(daysAgo => {
                            const date = new Date();
                            date.setDate(date.getDate() - daysAgo);
                            return getLocalDateString(date);
                        }),
                        platform: fc.constantFrom('facebook', 'instagram', 'both'),
                        format: fc.constantFrom('post', 'reel', 'story'),
                        topic: fc.string({ minLength: 1, maxLength: 100 }),
                        caption: fc.string({ minLength: 1, maxLength: 500 }),
                        status: fc.constantFrom('planned', 'published', 'failed')
                    }),
                    { minLength: 0, maxLength: 50 }
                ),
                async (posts) => {
                    const db = getDatabase();
                    
                    // Clear the database before each iteration to ensure isolation
                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM post_history', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    // Insert all generated posts
                    const insertSQL = `
                        INSERT INTO post_history 
                        (target_date, platform, format, topic, caption, status)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    
                    for (const post of posts) {
                        await new Promise((resolve, reject) => {
                            db.run(
                                insertSQL,
                                [post.target_date, post.platform, post.format, post.topic, post.caption, post.status],
                                (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });
                    }
                    
                    // Query historical posts using the function under test
                    const results = await getHistoricalPosts(7);
                    
                    // Calculate the cutoff date (7 days ago)
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - 7);
                    const cutoffDateStr = getLocalDateString(cutoffDate);
                    
                    // Verify all results meet the criteria
                    for (const result of results) {
                        // Must have status 'published'
                        expect(result.status).toBe('published');
                        
                        // Must be from last 7 days (target_date >= cutoffDate)
                        expect(result.target_date >= cutoffDateStr).toBe(true);
                    }
                    
                    // Verify no valid posts were excluded
                    const expectedPosts = posts.filter(p => 
                        p.status === 'published' && p.target_date >= cutoffDateStr
                    );
                    
                    expect(results.length).toBe(expectedPosts.length);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 3: Complete Column Retrieval
     * Validates: Requirements 2.2
     * 
     * For any post retrieved from the database, all columns (id, target_date, platform,
     * format, topic, caption, media_url, likes, reach, ai_analysis, status) should be
     * present in the result.
     */
    test('Feature: ai-social-media-manager, Property 3: Complete column retrieval', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    target_date: fc.integer({ min: 0, max: 6 }).map(daysAgo => {
                        const date = new Date();
                        date.setDate(date.getDate() - daysAgo);
                        return getLocalDateString(date);
                    }),
                    platform: fc.constantFrom('facebook', 'instagram', 'both'),
                    format: fc.constantFrom('post', 'reel', 'story'),
                    topic: fc.string({ minLength: 1, maxLength: 100 }),
                    caption: fc.string({ minLength: 1, maxLength: 500 }),
                    media_url: fc.option(fc.webUrl(), { nil: null }),
                    likes: fc.integer({ min: 0, max: 10000 }),
                    reach: fc.integer({ min: 0, max: 100000 }),
                    ai_analysis: fc.string({ minLength: 1, maxLength: 200 })
                }),
                async (postData) => {
                    const db = getDatabase();
                    
                    // Clear the database before each iteration to ensure isolation
                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM post_history', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    // Insert a published post with all fields
                    const insertSQL = `
                        INSERT INTO post_history 
                        (target_date, platform, format, topic, caption, media_url, likes, reach, ai_analysis, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    await new Promise((resolve, reject) => {
                        db.run(
                            insertSQL,
                            [
                                postData.target_date,
                                postData.platform,
                                postData.format,
                                postData.topic,
                                postData.caption,
                                postData.media_url,
                                postData.likes,
                                postData.reach,
                                postData.ai_analysis,
                                'published'
                            ],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                    
                    // Retrieve historical posts
                    const results = await getHistoricalPosts(7);
                    
                    // Verify at least one post was retrieved
                    expect(results.length).toBeGreaterThan(0);
                    
                    // Verify all required columns are present in each result
                    for (const post of results) {
                        expect(post).toHaveProperty('id');
                        expect(post).toHaveProperty('target_date');
                        expect(post).toHaveProperty('platform');
                        expect(post).toHaveProperty('format');
                        expect(post).toHaveProperty('topic');
                        expect(post).toHaveProperty('caption');
                        expect(post).toHaveProperty('media_url');
                        expect(post).toHaveProperty('likes');
                        expect(post).toHaveProperty('reach');
                        expect(post).toHaveProperty('ai_analysis');
                        expect(post).toHaveProperty('status');
                        
                        // Verify types are correct
                        expect(typeof post.id).toBe('number');
                        expect(typeof post.target_date).toBe('string');
                        expect(typeof post.platform).toBe('string');
                        expect(typeof post.format).toBe('string');
                        expect(typeof post.topic).toBe('string');
                        expect(typeof post.caption).toBe('string');
                        expect(typeof post.likes).toBe('number');
                        expect(typeof post.reach).toBe('number');
                        expect(typeof post.ai_analysis).toBe('string');
                        expect(typeof post.status).toBe('string');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 6: Content Plan Persistence
     * Validates: Requirements 4.1, 4.3
     * 
     * For any valid content plan, inserting it into the database should increase
     * the record count by 1 and the new record should have status 'planned'.
     */
    test('Feature: ai-social-media-manager, Property 6: Content plan persistence', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    format: fc.constantFrom('post', 'reel', 'story'),
                    topic: fc.string({ minLength: 1, maxLength: 100 }),
                    caption: fc.string({ minLength: 1, maxLength: 500 }),
                    media_prompt: fc.string({ minLength: 1, maxLength: 200 }),
                    ai_analysis: fc.string({ minLength: 1, maxLength: 200 })
                }),
                async (plan) => {
                    const db = getDatabase();
                    
                    // Clear the database before each iteration to ensure isolation
                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM post_history', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    // Get initial record count
                    const initialCount = await new Promise((resolve, reject) => {
                        db.get('SELECT COUNT(*) as count FROM post_history', (err, row) => {
                            if (err) reject(err);
                            else resolve(row.count);
                        });
                    });
                    
                    // Insert content plan
                    const insertedId = await insertContentPlan(plan);
                    
                    // Get new record count
                    const newCount = await new Promise((resolve, reject) => {
                        db.get('SELECT COUNT(*) as count FROM post_history', (err, row) => {
                            if (err) reject(err);
                            else resolve(row.count);
                        });
                    });
                    
                    // Verify count increased by 1
                    expect(newCount).toBe(initialCount + 1);
                    
                    // Retrieve the inserted record
                    const insertedRecord = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM post_history WHERE id = ?', [insertedId], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });
                    
                    // Verify the record has status 'planned'
                    expect(insertedRecord.status).toBe('planned');
                    
                    // Verify the plan data was stored correctly
                    expect(insertedRecord.format).toBe(plan.format);
                    expect(insertedRecord.topic).toBe(plan.topic);
                    expect(insertedRecord.caption).toBe(plan.caption);
                    expect(insertedRecord.ai_analysis).toBe(plan.ai_analysis);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7: Target Date Calculation
     * Validates: Requirements 4.2
     * 
     * For any content plan inserted during the nightly analysis phase, the target_date
     * should be exactly one day after the current date.
     */
    test('Feature: ai-social-media-manager, Property 7: Target date calculation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    format: fc.constantFrom('post', 'reel', 'story'),
                    topic: fc.string({ minLength: 1, maxLength: 100 }),
                    caption: fc.string({ minLength: 1, maxLength: 500 }),
                    media_prompt: fc.string({ minLength: 1, maxLength: 200 }),
                    ai_analysis: fc.string({ minLength: 1, maxLength: 200 })
                }),
                async (plan) => {
                    const db = getDatabase();
                    
                    // Clear the database before each iteration to ensure isolation
                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM post_history', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    // Calculate expected target date (tomorrow)
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const expectedTargetDate = getLocalDateString(tomorrow);
                    
                    // Insert content plan
                    const insertedId = await insertContentPlan(plan);
                    
                    // Retrieve the inserted record
                    const insertedRecord = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM post_history WHERE id = ?', [insertedId], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });
                    
                    // Verify target_date is exactly one day after current date
                    expect(insertedRecord.target_date).toBe(expectedTargetDate);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 8: Platform Derivation from Format
     * Validates: Requirements 4.4
     * 
     * For any content plan, the platform should be correctly derived from the format:
     * 'both' for 'post' and 'story' formats, 'instagram' for 'reel' format.
     */
    test('Feature: ai-social-media-manager, Property 8: Platform derivation from format', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    format: fc.constantFrom('post', 'reel', 'story'),
                    topic: fc.string({ minLength: 1, maxLength: 100 }),
                    caption: fc.string({ minLength: 1, maxLength: 500 }),
                    media_prompt: fc.string({ minLength: 1, maxLength: 200 }),
                    ai_analysis: fc.string({ minLength: 1, maxLength: 200 })
                }),
                async (plan) => {
                    const db = getDatabase();
                    
                    // Clear the database before each iteration to ensure isolation
                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM post_history', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    // Insert content plan
                    const insertedId = await insertContentPlan(plan);
                    
                    // Retrieve the inserted record
                    const insertedRecord = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM post_history WHERE id = ?', [insertedId], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });
                    
                    // Verify platform is correctly derived from format
                    if (plan.format === 'reel') {
                        expect(insertedRecord.platform).toBe('instagram');
                    } else {
                        // 'post' and 'story' formats should map to 'both'
                        expect(insertedRecord.platform).toBe('both');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 14: Status Update Reflects Publish Outcome
     * Validates: Requirements 8.1, 8.2
     * 
     * For any publish operation, the post status in the database should be updated
     * to 'published' if successful, or 'failed' if an error occurred.
     */
    test('Feature: ai-social-media-manager, Property 14: Status update reflects publish outcome', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    format: fc.constantFrom('post', 'reel', 'story'),
                    topic: fc.string({ minLength: 1, maxLength: 100 }),
                    caption: fc.string({ minLength: 1, maxLength: 500 }),
                    media_prompt: fc.string({ minLength: 1, maxLength: 200 }),
                    ai_analysis: fc.string({ minLength: 1, maxLength: 200 }),
                    publishSuccess: fc.boolean(),
                    errorDetails: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null })
                }),
                async (testData) => {
                    const db = getDatabase();
                    
                    // Clear the database before each iteration to ensure isolation
                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM post_history', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    // Insert a content plan (starts with status 'planned')
                    const plan = {
                        format: testData.format,
                        topic: testData.topic,
                        caption: testData.caption,
                        media_prompt: testData.media_prompt,
                        ai_analysis: testData.ai_analysis
                    };
                    
                    const insertedId = await insertContentPlan(plan);
                    
                    // Verify initial status is 'planned'
                    const initialRecord = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM post_history WHERE id = ?', [insertedId], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });
                    expect(initialRecord.status).toBe('planned');
                    
                    // Simulate publish operation outcome
                    if (testData.publishSuccess) {
                        // Successful publish - update status to 'published'
                        await updatePostStatus(insertedId, 'published');
                        
                        // Verify status was updated to 'published'
                        const updatedRecord = await new Promise((resolve, reject) => {
                            db.get('SELECT * FROM post_history WHERE id = ?', [insertedId], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        });
                        expect(updatedRecord.status).toBe('published');
                    } else {
                        // Failed publish - update status to 'failed'
                        await updatePostStatus(insertedId, 'failed', testData.errorDetails);
                        
                        // Verify status was updated to 'failed'
                        const updatedRecord = await new Promise((resolve, reject) => {
                            db.get('SELECT * FROM post_history WHERE id = ?', [insertedId], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        });
                        expect(updatedRecord.status).toBe('failed');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15: Metrics Synchronization Round Trip
     * Validates: Requirements 9.2, 9.3
     * 
     * For any recently published post, retrieving metrics from the Meta Graph API
     * and updating the database should result in the likes and reach columns
     * containing the retrieved values.
     */
    test('Feature: ai-social-media-manager, Property 15: Metrics synchronization round trip', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    format: fc.constantFrom('post', 'reel', 'story'),
                    topic: fc.string({ minLength: 1, maxLength: 100 }),
                    caption: fc.string({ minLength: 1, maxLength: 500 }),
                    media_prompt: fc.string({ minLength: 1, maxLength: 200 }),
                    ai_analysis: fc.string({ minLength: 1, maxLength: 200 }),
                    // Simulate metrics retrieved from Meta Graph API
                    retrievedLikes: fc.integer({ min: 0, max: 100000 }),
                    retrievedReach: fc.integer({ min: 0, max: 1000000 })
                }),
                async (testData) => {
                    const db = getDatabase();
                    
                    // Clear the database before each iteration to ensure isolation
                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM post_history', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    // Insert a content plan (starts with default metrics: likes=0, reach=0)
                    const plan = {
                        format: testData.format,
                        topic: testData.topic,
                        caption: testData.caption,
                        media_prompt: testData.media_prompt,
                        ai_analysis: testData.ai_analysis
                    };
                    
                    const insertedId = await insertContentPlan(plan);
                    
                    // Update status to 'published' to simulate a published post
                    await updatePostStatus(insertedId, 'published');
                    
                    // Verify initial metrics are 0 (default values)
                    const initialRecord = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM post_history WHERE id = ?', [insertedId], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });
                    expect(initialRecord.likes).toBe(0);
                    expect(initialRecord.reach).toBe(0);
                    
                    // Simulate retrieving metrics from Meta Graph API and updating the database
                    await updatePostMetrics(insertedId, testData.retrievedLikes, testData.retrievedReach);
                    
                    // Verify the database now contains the retrieved metrics values
                    const updatedRecord = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM post_history WHERE id = ?', [insertedId], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });
                    
                    // The round trip is complete: API values → updatePostMetrics → database
                    expect(updatedRecord.likes).toBe(testData.retrievedLikes);
                    expect(updatedRecord.reach).toBe(testData.retrievedReach);
                }
            ),
            { numRuns: 100 }
        );
    }, 10000);
});

describe('Database Module - Unit Tests', () => {
    beforeEach(async () => {
        // Create unique test database path
        TEST_DB_PATH = path.join(__dirname, `test_social_media_${Date.now()}_${Math.random()}.db`);
        
        // Override DB_PATH for testing
        process.env.TEST_MODE = 'true';
        process.env.TEST_DB_PATH = TEST_DB_PATH;
        
        // Initialize fresh database
        await initializeDatabase();
    });

    afterEach(async () => {
        // Close database connection
        await closeDatabase();
        
        // Clean up test database
        if (fs.existsSync(TEST_DB_PATH)) {
            try {
                fs.unlinkSync(TEST_DB_PATH);
            } catch (err) {
                // Ignore cleanup errors
            }
        }
    });

    /**
     * Unit Test: getHistoricalPosts returns empty array when no posts exist
     * Validates: Requirements 2.3
     */
    test('should return empty array when no historical posts exist', async () => {
        const posts = await getHistoricalPosts(7);
        expect(posts).toEqual([]);
    });

    /**
     * Unit Test: getHistoricalPosts filters by status 'published'
     * Validates: Requirements 2.1
     */
    test('should return only published posts', async () => {
        const db = getDatabase();
        
        // Insert posts with different statuses
        const insertSQL = `
            INSERT INTO post_history 
            (target_date, platform, format, topic, caption, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const today = getLocalDateString();
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, [today, 'facebook', 'post', 'Test 1', 'Caption 1', 'published'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, [today, 'facebook', 'post', 'Test 2', 'Caption 2', 'planned'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, [today, 'facebook', 'post', 'Test 3', 'Caption 3', 'failed'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        const posts = await getHistoricalPosts(7);
        
        // Should only return the published post
        expect(posts.length).toBe(1);
        expect(posts[0].status).toBe('published');
        expect(posts[0].topic).toBe('Test 1');
    });

    /**
     * Unit Test: getHistoricalPosts filters by date range
     * Validates: Requirements 2.1
     */
    test('should return only posts from last N days', async () => {
        const db = getDatabase();
        
        const insertSQL = `
            INSERT INTO post_history 
            (target_date, platform, format, topic, caption, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        // Insert post from 5 days ago (should be included)
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const fiveDaysAgoStr = getLocalDateString(fiveDaysAgo);
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, [fiveDaysAgoStr, 'facebook', 'post', 'Recent', 'Caption', 'published'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Insert post from 10 days ago (should be excluded)
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const tenDaysAgoStr = getLocalDateString(tenDaysAgo);
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, [tenDaysAgoStr, 'facebook', 'post', 'Old', 'Caption', 'published'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        const posts = await getHistoricalPosts(7);
        
        // Should only return the recent post
        expect(posts.length).toBe(1);
        expect(posts[0].topic).toBe('Recent');
    });

    /**
     * Unit Test: getHistoricalPosts returns all columns
     * Validates: Requirements 2.2
     */
    test('should return all columns including metrics', async () => {
        const db = getDatabase();
        
        const insertSQL = `
            INSERT INTO post_history 
            (target_date, platform, format, topic, caption, media_url, likes, reach, ai_analysis, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const today = getLocalDateString();
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, [
                today, 
                'facebook', 
                'post', 
                'Test Topic', 
                'Test Caption',
                'https://example.com/image.jpg',
                100,
                5000,
                'AI analysis text',
                'published'
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        const posts = await getHistoricalPosts(7);
        
        expect(posts.length).toBe(1);
        const post = posts[0];
        
        // Verify all columns are present
        expect(post).toHaveProperty('id');
        expect(post).toHaveProperty('target_date');
        expect(post).toHaveProperty('platform');
        expect(post).toHaveProperty('format');
        expect(post).toHaveProperty('topic');
        expect(post).toHaveProperty('caption');
        expect(post).toHaveProperty('media_url');
        expect(post).toHaveProperty('likes');
        expect(post).toHaveProperty('reach');
        expect(post).toHaveProperty('ai_analysis');
        expect(post).toHaveProperty('status');
        
        // Verify values
        expect(post.topic).toBe('Test Topic');
        expect(post.likes).toBe(100);
        expect(post.reach).toBe(5000);
    });
});
