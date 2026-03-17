const fc = require('fast-check');

// Mock dependencies
jest.mock('./db');
jest.mock('./services/aiService');
jest.mock('./jobs/dailyManager');
jest.mock('node-cron');

describe('Application Entry Point - Unit Tests', () => {
    let db, aiService, dailyManager, cron, index;
    let originalEnv, originalExit, originalLog, originalError, originalWarn;

    beforeEach(() => {
        // Save original environment and functions
        originalEnv = { ...process.env };
        originalExit = process.exit;
        originalLog = console.log;
        originalError = console.error;
        originalWarn = console.warn;
        
        // Mock process.exit
        process.exit = jest.fn();
        
        // Mock console functions
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
        
        // Clear module cache
        jest.resetModules();
        
        // Set test environment
        process.env.NODE_ENV = 'test';
        process.env.GEMINI_API_KEY = 'test_api_key';
        
        // Re-require modules
        db = require('./db');
        aiService = require('./services/aiService');
        dailyManager = require('./jobs/dailyManager');
        cron = require('node-cron');
        index = require('./index');

        // Setup default mock implementations
        db.initializeDatabase.mockResolvedValue();
        db.closeDatabase.mockResolvedValue();
        db.getDatabase.mockReturnValue({
            get: jest.fn((query, params, cb) => cb(null, null))
        });
        
        aiService.initializeGemini.mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore original functions and environment
        process.exit = originalExit;
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        process.env = originalEnv;
    });

    test('should initialize components in correct order', async () => {
        await index.main();
        
        // Order: validateEnvironment -> initializeDatabase -> initializeGemini -> registerCronJobs
        expect(db.initializeDatabase).toHaveBeenCalled();
        expect(aiService.initializeGemini).toHaveBeenCalled();
        expect(cron.schedule).toHaveBeenCalled();
    });

    test('should register cron jobs with correct schedules', async () => {
        await index.main();
        
        // Check nightly analysis schedule (11:30 PM)
        expect(cron.schedule).toHaveBeenCalledWith(
            '30 23 * * *',
            expect.any(Function)
        );
        
        // Check execution phase schedule (11:35 PM)
        expect(cron.schedule).toHaveBeenCalledWith(
            '35 23 * * *',
            expect.any(Function)
        );
        
        // Check analytics sync schedule (11:00 PM)
        expect(cron.schedule).toHaveBeenCalledWith(
            '0 23 * * *',
            expect.any(Function)
        );
    });

    test('should exit when GEMINI_API_KEY is missing', async () => {
        delete process.env.GEMINI_API_KEY;
        
        await index.main();
        
        expect(process.exit).toHaveBeenCalledWith(1);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('GEMINI_API_KEY')
        );
    });

    test('should log warnings for missing optional credentials', async () => {
        delete process.env.FB_PAGE_ACCESS_TOKEN;
        delete process.env.FB_PAGE_ID;
        delete process.env.IG_BUSINESS_ID;
        
        await index.main();
        
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('FB_PAGE_ACCESS_TOKEN')
        );
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('FB_PAGE_ID')
        );
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('IG_BUSINESS_ID')
        );
    });
});

describe('Application Entry Point - Property Tests', () => {
    let db, aiService, dailyManager, cron, index;
    let originalEnv, originalExit;

    beforeEach(() => {
        originalEnv = { ...process.env };
        originalExit = process.exit;
        process.exit = jest.fn();
        jest.resetModules();
        process.env.NODE_ENV = 'test';
        process.env.GEMINI_API_KEY = 'test_api_key';
        
        db = require('./db');
        aiService = require('./services/aiService');
        dailyManager = require('./jobs/dailyManager');
        cron = require('node-cron');
        index = require('./index');
        
        db.initializeDatabase.mockResolvedValue();
        db.getDatabase.mockReturnValue({ get: jest.fn((q, p, cb) => cb(null, null)) });
    });

    afterEach(() => {
        process.exit = originalExit;
        process.env = originalEnv;
    });

    test('Feature: ai-social-media-manager, Property 19: Environment validation resilience', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    geminiKey: fc.option(fc.string(), { nil: undefined }),
                    fbToken: fc.option(fc.string(), { nil: undefined }),
                    fbId: fc.option(fc.string(), { nil: undefined }),
                    igId: fc.option(fc.string(), { nil: undefined })
                }),
                async (config) => {
                    jest.clearAllMocks();
                    if (config.geminiKey) process.env.GEMINI_API_KEY = config.geminiKey;
                    else delete process.env.GEMINI_API_KEY;
                    
                    if (config.fbToken) process.env.FB_PAGE_ACCESS_TOKEN = config.fbToken;
                    else delete process.env.FB_PAGE_ACCESS_TOKEN;
                    
                    await index.main();
                    
                    if (!config.geminiKey) {
                        expect(process.exit).toHaveBeenCalledWith(1);
                    } else {
                        expect(db.initializeDatabase).toHaveBeenCalled();
                    }
                }
            ),
            { numRuns: 50 }
        );
    });
});
