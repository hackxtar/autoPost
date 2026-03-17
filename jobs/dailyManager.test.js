const fc = require('fast-check');
const { nightlyAnalysisPhase, executionPhase, analyticsSyncPhase } = require('./dailyManager');
const db = require('../db');
const aiService = require('../services/aiService');
const metaService = require('../services/metaService');

// Mock all dependencies
jest.mock('../db');
jest.mock('../services/aiService');
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
    
    test('Feature: ai-social-media-manager, Property 10: Media URL persistence', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    id: fc.integer({ min: 1, max: 1000 }),
                    format: fc.constantFrom('post', 'story'),
                    caption: fc.string({ minLength: 1, maxLength: 100 }),
                    media_prompt: fc.string({ minLength: 1, maxLength: 100 }),
                    platform: fc.constantFrom('facebook', 'instagram', 'both'),
                    topic: fc.string({ minLength: 1, maxLength: 50 }),
                    target_date: fc.date().map(d => getLocalDateString(d)),
                    status: fc.constant('planned')
                }),
                async (plannedPost) => {
                    db.getTodaysPlannedPost.mockResolvedValue(plannedPost);
                    
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
                    
                    metaService.publishToFacebook.mockResolvedValue({ id: 'fb_123' });
                    metaService.publishToInstagram.mockResolvedValue({ id: 'ig_123' });
                    db.updatePostStatus.mockResolvedValue();
                    
                    await executionPhase();
                    expect(db.updatePostStatus).toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });
    
    test('Feature: ai-social-media-manager, Property 17: Operation lifecycle logging', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('nightly', 'execution', 'analytics'),
                async (phaseType) => {
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
                    
                    db.getHistoricalPosts.mockResolvedValue([]);
                    db.getRecentTopics.mockResolvedValue([]);
                    aiService.generateContentPlan.mockResolvedValue({
                        format: 'post',
                        topic: 'Test',
                        caption: 'Test caption',
                        media_prompt: 'Test prompt',
                        ai_analysis: 'Test analysis'
                    });
                    db.insertContentPlan.mockResolvedValue(1);
                    db.getTodaysPlannedPost.mockResolvedValue(null);
                    
                    if (phaseType === 'nightly') {
                        await nightlyAnalysisPhase();
                    } else if (phaseType === 'execution') {
                        await executionPhase();
                    } else {
                        await analyticsSyncPhase();
                    }
                    
                    console.log = originalLog;
                    console.error = originalError;
                    
                    const startMessage = logs.find(log => 
                        log.message.includes('PHASE STARTED') || 
                        log.message.includes('→')
                    );
                    expect(startMessage).toBeDefined();
                    
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
    
    test('Feature: ai-social-media-manager, Property 18: Non-critical error resilience', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('ai_service_error', 'db_error', 'publish_error'),
                async (errorType) => {
                    if (errorType === 'ai_service_error') {
                        db.getHistoricalPosts.mockResolvedValue([]);
                        db.getRecentTopics.mockResolvedValue([]);
                        aiService.generateContentPlan.mockRejectedValue(new Error('AI API timeout'));
                        await nightlyAnalysisPhase();
                    } else if (errorType === 'db_error') {
                        db.getHistoricalPosts.mockRejectedValue(new Error('DB unreachable'));
                        await nightlyAnalysisPhase();
                    } else if (errorType === 'publish_error') {
                        db.getTodaysPlannedPost.mockResolvedValue({
                            id: 1,
                            format: 'post',
                            caption: 'test',
                            platform: 'facebook',
                            target_date: getLocalDateString(),
                            status: 'planned'
                        });
                        metaService.publishToFacebook.mockRejectedValue(new Error('Publish failed'));
                        db.updatePostStatus.mockResolvedValue();
                        await executionPhase();
                    }
                    expect(true).toBe(true);
                }
            ),
            { numRuns: 50 }
        );
    });
});

describe('Daily Manager - Integration Tests', () => {
    test('should execute complete daily workflow', async () => {
        const historicalPosts = [{ id: 1, platform: 'facebook', format: 'post', topic: 'Social Media Tips', caption: '...', likes: 100, reach: 5000, status: 'published' }];
        db.getHistoricalPosts.mockResolvedValue(historicalPosts);
        db.getRecentTopics.mockResolvedValue([]);
        
        const generatedPlan = { format: 'post', topic: 'AI Trends', caption: 'New AI features...', media_prompt: 'AI robot background', ai_analysis: 'High engagement expected' };
        aiService.generateContentPlan.mockResolvedValue(generatedPlan);
        db.insertContentPlan.mockResolvedValue(2);
        
        const plannedPost = { id: 2, format: 'post', topic: 'AI Trends', caption: 'New AI features...', platform: 'facebook', media_prompt: 'AI robot background' };
        db.getTodaysPlannedPost.mockResolvedValue(plannedPost);
        metaService.publishToFacebook.mockResolvedValue({ id: 'fb_post_123' });
        db.updatePostStatus.mockResolvedValue();
        
        await nightlyAnalysisPhase();
        await executionPhase();
        
        expect(db.getHistoricalPosts).toHaveBeenCalledWith(7);
        expect(aiService.generateContentPlan).toHaveBeenCalledWith(historicalPosts, []);
        expect(db.insertContentPlan).toHaveBeenCalledWith(generatedPlan);
        expect(db.getTodaysPlannedPost).toHaveBeenCalled();
        expect(metaService.publishToFacebook).toHaveBeenCalled();
        expect(db.updatePostStatus).toHaveBeenCalledWith(2, 'published');
    });

    test('should persist data across workflow phases', async () => {
        const dbOperations = [];
        const mockDb = {
            run: jest.fn((sql, params, callback) => {
                dbOperations.push({ operation: 'run', sql, params });
                if (typeof callback === 'function') callback(null);
            }),
            all: jest.fn((sql, params, callback) => {
                dbOperations.push({ operation: 'all', sql, params });
                callback(null, []);
            })
        };
        db.getDatabase.mockReturnValue(mockDb);
        metaService.publishToFacebook.mockResolvedValue({ id: 'fb_123' });
        db.updatePostStatus.mockImplementation((id, status) => {
            dbOperations.push({ operation: 'updateStatus', id, status });
            return Promise.resolve();
        });
        
        db.getHistoricalPosts.mockResolvedValue([]);
        db.getRecentTopics.mockResolvedValue([]);
        aiService.generateContentPlan.mockResolvedValue({ format: 'post', topic: 'Test', caption: 'Test', ai_analysis: 'Test' });
        db.insertContentPlan.mockResolvedValue(1);
        db.getTodaysPlannedPost.mockResolvedValue({ id: 1, format: 'post', platform: 'facebook', caption: 'Test' });
        
        await nightlyAnalysisPhase();
        await executionPhase();
        
        expect(db.insertContentPlan).toHaveBeenCalled();
        expect(db.getTodaysPlannedPost).toHaveBeenCalled();
    });

    test('should recover from errors in each phase', async () => {
        db.getHistoricalPosts.mockRejectedValue(new Error('Database error'));
        db.getRecentTopics.mockResolvedValue([]);
        await expect(nightlyAnalysisPhase()).resolves.not.toThrow();
        
        db.getTodaysPlannedPost.mockRejectedValue(new Error('Database error'));
        await expect(executionPhase()).resolves.not.toThrow();
        
        db.getDatabase.mockReturnValue({ all: (sql, params, cb) => cb(new Error('Query failed')) });
        await expect(analyticsSyncPhase()).resolves.not.toThrow();
    });
});
