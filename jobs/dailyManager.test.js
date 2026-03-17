const fc = require('fast-check');
const { nightlyAnalysisPhase, executionPhase, analyticsSyncPhase } = require('./dailyManager');
const db = require('../db');
const aiService = require('../services/aiService');
const mediaService = require('../services/mediaService');
const metaService = require('../services/metaService');

// Mock all dependencies
jest.mock('../db');
jest.mock('../services/aiService');
jest.mock('../services/mediaService');
jest.mock('../services/metaService');

/**
 * Utility to get local YYYY-MM-DD string
 */
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

describe('Daily Manager - Property Tests', () => {
    
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        
        // Setup default mock implementations
        db.getDatabase.mockReturnValue({
            run: jest.fn((sql, params, callback) => {
                if (typeof params === 'function') {
                    params(null);
                } else {
                    callback(null);
                }
            }),
            get: jest.fn((sql, params, callback) => callback(null, null)),
            all: jest.fn((sql, params, callback) => callback(null, []))
        });
    });
    
    /**
     * Property 10: Media URL Persistence
     * Validates: Requirements 5.3
     * 
     * For any generated media URL, it should be stored in the corresponding post
     * record's media_url field in the database.
     */
    test('Feature: ai-social-media-manager, Property 10: Media URL persistence', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    id: fc.integer({ min: 1, max: 1000 }),
                    format: fc.constantFrom('post', 'story'), // Only formats that generate media
                    caption: fc.string({ minLength: 1, maxLength: 100 }),
                    media_prompt: fc.string({ minLength: 1, maxLength: 100 }),
                    platform: fc.constantFrom('facebook', 'instagram', 'both'),
                    topic: fc.string({ minLength: 1, maxLength: 50 }),
                    target_date: fc.date().map(d => getLocalDateString(d)),
                    status: fc.constant('planned')
                }),
                async (plannedPost) => {
                    // Mock getTodaysPlannedPost to return our test post
                    db.getTodaysPlannedPost.mockResolvedValue(plannedPost);
                    
                    // Track database updates
                    const dbUpdates = [];
                    const mockDb = {
                        run: jest.fn((sql, params, callback) => {
                            dbUpdates.push({ sql, params });
                            if (typeof callback === 'function') {
                                callback(null);
                            }
                        })
                    };
                    db.getDatabase.mockReturnValue(mockDb);
                    
                    // Mock media generation to return a URL
                    const generatedMediaUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(plannedPost.media_prompt)}`;
                    mediaService.generateMedia.mockReturnValue(generatedMediaUrl);
                    
                    // Mock publishing functions
                    metaService.publishToFacebook.mockResolvedValue({ id: 'fb_123' });
                    metaService.publishToInstagram.mockResolvedValue({ id: 'ig_123' });
                    
                    // Mock updatePostStatus
                    db.updatePostStatus.mockResolvedValue();
                    
                    // Execute the execution phase
                    await executionPhase();
                    
                    // Verify media was generated
                    expect(mediaService.generateMedia).toHaveBeenCalledWith(
                        plannedPost.format,
                        expect.any(String)
                    );
                    
                    // Verify database was updated with media URL
                    const mediaUrlUpdate = dbUpdates.find(update => 
                        update.sql.includes('UPDATE post_history SET media_url')
                    );
                    
                    expect(mediaUrlUpdate).toBeDefined();
                    expect(mediaUrlUpdate.params[0]).toBe(generatedMediaUrl);
                    expect(mediaUrlUpdate.params[1]).toBe(plannedPost.id);
                }
            ),
            { numRuns: 100 }
        );
    });
    
    /**
     * Property 17: Operation Lifecycle Logging
     * Validates: Requirements 10.5, 12.3, 12.4
     * 
     * For any major operation (phase execution, publish, sync), the logs should
     * contain both a start message and a completion message with status indicator.
     */
    test('Feature: ai-social-media-manager, Property 17: Operation lifecycle logging', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('nightly', 'execution', 'analytics'),
                async (phaseType) => {
                    // Capture console logs
                    const logs = [];
                    const originalLog = console.log;
                    const originalError = console.error;
                    console.log = jest.fn((...args) => {
                        logs.push({ level: 'log', message: args.join(' ') });
                        originalLog(...args);
                    });
                    console.error = jest.fn((...args) => {
                        logs.push({ level: 'error', message: args.join(' ') });
                        originalError(...args);
                    });
                    
                    // Mock successful operations
                    db.getHistoricalPosts.mockResolvedValue([]);
                    aiService.generateContentPlan.mockResolvedValue({
                        format: 'post',
                        topic: 'Test',
                        caption: 'Test caption',
                        media_prompt: 'Test prompt',
                        ai_analysis: 'Test analysis'
                    });
                    db.insertContentPlan.mockResolvedValue(1);
                    db.getTodaysPlannedPost.mockResolvedValue(null);
                    
                    // Execute the appropriate phase
                    if (phaseType === 'nightly') {
                        await nightlyAnalysisPhase();
                    } else if (phaseType === 'execution') {
                        await executionPhase();
                    } else {
                        await analyticsSyncPhase();
                    }
                    
                    // Restore console
                    console.log = originalLog;
                    console.error = originalError;
                    
                    // Verify start message exists
                    const startMessage = logs.find(log => 
                        log.message.includes('PHASE STARTED') || 
                        log.message.includes('→')
                    );
                    expect(startMessage).toBeDefined();
                    
                    // Verify completion message exists
                    const completionMessage = logs.find(log => 
                        log.message.includes('PHASE COMPLETED') || 
                        log.message.includes('✓')
                    );
                    expect(completionMessage).toBeDefined();
                }
            ),
            { numRuns: 50 }
        );
    });
    
    /**
     * Property 18: Non-Critical Error Resilience
     * Validates: Requirements 12.5
     * 
     * For any non-critical error (missing optional configuration, API timeout,
     * single publish failure), the system process should continue running without
     * termination.
     */
    test('Feature: ai-social-media-manager, Property 18: Non-critical error resilience', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(
                    'ai_service_error',
                    'publish_error',
                    'metrics_error'
                ),
                async (errorType) => {
                    // Track if process.exit was called
                    const originalExit = process.exit;
                    let exitCalled = false;
                    process.exit = jest.fn(() => {
                        exitCalled = true;
                    });
                    
                    // Setup mocks based on error type
                    if (errorType === 'ai_service_error') {
                        db.getHistoricalPosts.mockResolvedValue([]);
                        aiService.generateContentPlan.mockRejectedValue(new Error('AI API timeout'));
                        
                        // Execute nightly analysis phase
                        await nightlyAnalysisPhase();
                        
                    } else if (errorType === 'publish_error') {
                        db.getTodaysPlannedPost.mockResolvedValue({
                            id: 1,
                            format: 'post',
                            caption: 'Test',
                            platform: 'facebook',
                            topic: 'Test',
                            target_date: getLocalDateString(),
                            status: 'planned'
                        });
                        mediaService.generateMedia.mockReturnValue('https://example.com/image.jpg');
                        metaService.publishToFacebook.mockRejectedValue(new Error('Publish failed'));
                        db.updatePostStatus.mockResolvedValue();
                        
                        const mockDb = {
                            run: jest.fn((sql, params, callback) => {
                                if (typeof callback === 'function') {
                                    callback(null);
                                }
                            })
                        };
                        db.getDatabase.mockReturnValue(mockDb);
                        
                        // Execute execution phase
                        await executionPhase();
                        
                    } else if (errorType === 'metrics_error') {
                        // Mock analytics sync with error
                        const mockDb = {
                            all: jest.fn((sql, params, callback) => {
                                callback(new Error('Database query failed'), null);
                            })
                        };
                        db.getDatabase.mockReturnValue(mockDb);
                        
                        // Execute analytics sync phase
                        await analyticsSyncPhase();
                    }
                    
                    // Restore process.exit
                    process.exit = originalExit;
                    
                    // Verify process did NOT exit (system continues running)
                    expect(exitCalled).toBe(false);
                }
            ),
            { numRuns: 50 }
        );
    });
});

describe('Daily Manager - Integration Tests', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup default mock implementations
        db.getDatabase.mockReturnValue({
            run: jest.fn((sql, params, callback) => {
                if (typeof params === 'function') {
                    params(null);
                } else {
                    callback(null);
                }
            }),
            get: jest.fn((sql, params, callback) => callback(null, null)),
            all: jest.fn((sql, params, callback) => callback(null, []))
        });
    });
    
    /**
     * Integration Test: End-to-end nightly → execution → analytics flow
     * Validates: Requirements 10.2, 10.3, 10.4
     */
    test('should execute complete daily workflow', async () => {
        // Phase 1: Nightly Analysis
        const historicalPosts = [
            {
                id: 1,
                format: 'post',
                platform: 'facebook',
                topic: 'Social Media Tips',
                likes: 100,
                reach: 5000,
                status: 'published'
            }
        ];
        
        db.getHistoricalPosts.mockResolvedValue(historicalPosts);
        
        const generatedPlan = {
            format: 'post',
            topic: 'New Topic',
            caption: 'New Caption',
            media_prompt: 'New Prompt',
            ai_analysis: 'Analysis based on historical data'
        };
        
        aiService.generateContentPlan.mockResolvedValue(generatedPlan);
        db.insertContentPlan.mockResolvedValue(2);
        
        await nightlyAnalysisPhase();
        
        // Verify nightly analysis executed correctly
        expect(db.getHistoricalPosts).toHaveBeenCalledWith(7);
        expect(aiService.generateContentPlan).toHaveBeenCalledWith(historicalPosts);
        expect(db.insertContentPlan).toHaveBeenCalledWith(generatedPlan);
        
        // Phase 2: Execution
        const plannedPost = {
            id: 2,
            format: 'post',
            caption: 'New Caption',
            media_prompt: 'New Prompt',
            platform: 'facebook',
            topic: 'New Topic',
            target_date: getLocalDateString(),
            status: 'planned'
        };
        
        db.getTodaysPlannedPost.mockResolvedValue(plannedPost);
        mediaService.generateMedia.mockReturnValue('https://example.com/image.jpg');
        metaService.publishToFacebook.mockResolvedValue({ id: 'fb_post_123' });
        db.updatePostStatus.mockResolvedValue();
        
        const mockDb = {
            run: jest.fn((sql, params, callback) => {
                if (typeof callback === 'function') {
                    callback(null);
                }
            })
        };
        db.getDatabase.mockReturnValue(mockDb);
        
        await executionPhase();
        
        // Verify execution phase executed correctly
        expect(db.getTodaysPlannedPost).toHaveBeenCalled();
        expect(mediaService.generateMedia).toHaveBeenCalled();
        expect(metaService.publishToFacebook).toHaveBeenCalled();
        expect(db.updatePostStatus).toHaveBeenCalledWith(2, 'published');
        
        // Phase 3: Analytics Sync
        const recentPosts = [
            {
                id: 2,
                platform: 'facebook',
                media_url: 'https://example.com/image.jpg',
                status: 'published'
            }
        ];
        
        const mockDbForAnalytics = {
            all: jest.fn((sql, params, callback) => {
                callback(null, recentPosts);
            })
        };
        db.getDatabase.mockReturnValue(mockDbForAnalytics);
        
        metaService.getPostMetrics.mockResolvedValue({ likes: 150, reach: 6000 });
        db.updatePostMetrics.mockResolvedValue();
        
        await analyticsSyncPhase();
        
        // Verify analytics sync executed correctly
        expect(metaService.getPostMetrics).toHaveBeenCalled();
        expect(db.updatePostMetrics).toHaveBeenCalledWith(2, 150, 6000);
    });
    
    /**
     * Integration Test: Database persistence across phases
     * Validates: Requirements 10.2, 10.3, 10.4
     */
    test('should persist data across workflow phases', async () => {
        // Track all database operations
        const dbOperations = [];
        
        // Nightly phase: Insert content plan
        db.insertContentPlan.mockImplementation((plan) => {
            dbOperations.push({ operation: 'insert', data: plan });
            return Promise.resolve(1);
        });
        
        db.getHistoricalPosts.mockResolvedValue([]);
        aiService.generateContentPlan.mockResolvedValue({
            format: 'post',
            topic: 'Test',
            caption: 'Test',
            media_prompt: 'Test',
            ai_analysis: 'Test'
        });
        
        await nightlyAnalysisPhase();
        
        // Execution phase: Update with media URL and status
        db.getTodaysPlannedPost.mockResolvedValue({
            id: 1,
            format: 'post',
            caption: 'Test',
            platform: 'facebook',
            topic: 'Test',
            target_date: getLocalDateString(),
            status: 'planned'
        });
        
        const mockDb = {
            run: jest.fn((sql, params, callback) => {
                dbOperations.push({ operation: 'update', sql, params });
                if (typeof callback === 'function') {
                    callback(null);
                }
            })
        };
        db.getDatabase.mockReturnValue(mockDb);
        
        mediaService.generateMedia.mockReturnValue('https://example.com/image.jpg');
        metaService.publishToFacebook.mockResolvedValue({ id: 'fb_123' });
        db.updatePostStatus.mockImplementation((id, status) => {
            dbOperations.push({ operation: 'updateStatus', id, status });
            return Promise.resolve();
        });
        
        await executionPhase();
        
        // Analytics phase: Update with metrics
        db.updatePostMetrics.mockImplementation((id, likes, reach) => {
            dbOperations.push({ operation: 'updateMetrics', id, likes, reach });
            return Promise.resolve();
        });
        
        // Verify data persisted across all phases
        expect(dbOperations.length).toBeGreaterThan(0);
        expect(dbOperations.some(op => op.operation === 'insert')).toBe(true);
        expect(dbOperations.some(op => op.operation === 'update' || op.operation === 'updateStatus')).toBe(true);
    });
    
    /**
     * Integration Test: Error recovery in each phase
     * Validates: Requirements 10.2, 10.3, 10.4, 12.5
     */
    test('should recover from errors in each phase', async () => {
        // Test nightly phase error recovery
        db.getHistoricalPosts.mockRejectedValue(new Error('Database error'));
        
        // Should not throw - error is caught and logged
        await expect(nightlyAnalysisPhase()).resolves.not.toThrow();
        
        // Test execution phase error recovery
        db.getTodaysPlannedPost.mockRejectedValue(new Error('Database error'));
        
        await expect(executionPhase()).resolves.not.toThrow();
        
        // Test analytics phase error recovery
        const mockDb = {
            all: jest.fn((sql, params, callback) => {
                callback(new Error('Query failed'), null);
            })
        };
        db.getDatabase.mockReturnValue(mockDb);
        
        await expect(analyticsSyncPhase()).resolves.not.toThrow();
    });
});
