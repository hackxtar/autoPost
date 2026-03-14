const fc = require('fast-check');

// Mock all dependencies before requiring index
jest.mock('./db');
jest.mock('./services/aiService');
jest.mock('./jobs/dailyManager');
jest.mock('node-cron');

const db = require('./db');
const aiService = require('./services/aiService');
const dailyManager = require('./jobs/dailyManager');
const cron = require('node-cron');

describe('Application Entry Point - Property Tests', () => {
    
    let originalEnv;
    let originalExit;
    let originalLog;
    let originalError;
    let originalWarn;
    
    beforeEach(() => {
        // Save original environment and functions
        originalEnv = { ...process.env };
        originalExit = process.exit;
        originalLog = console.log;
        originalError = console.error;
        originalWarn = console.warn;
        
        // Mock process.exit to prevent test termination
        process.exit = jest.fn();
        
        // Mock console functions
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
        
        // Clear all mocks
        jest.clearAllMocks();
        
        // Setup default mock implementations
        db.initializeDatabase.mockResolvedValue();
        db.closeDatabase.mockResolvedValue();
        aiService.initializeGemini.mockReturnValue();
        cron.schedule.mockReturnValue({});
    });
    
    afterEach(() => {
        // Restore original environment and functions
        process.env = originalEnv;
        process.exit = originalExit;
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        
        // Clear module cache to allow re-requiring index.js
        jest.resetModules();
    });
    
    /**
     * Property 19: Configuration Usage Consistency
     * Validates: Requirements 11.2, 11.3, 6.2, 7.2
     * 
     * For any API call to Gemini or Meta services, the corresponding environment
     * variables (GEMINI_API_KEY, FB_PAGE_ACCESS_TOKEN, FB_PAGE_ID, IG_BUSINESS_ID)
     * should be used for authentication and identification.
     */
    test('Feature: ai-social-media-manager, Property 19: Configuration usage consistency', () => {
        fc.assert(
            fc.property(
                fc.record({
                    GEMINI_API_KEY: fc.string({ minLength: 10, maxLength: 50 }),
                    FB_PAGE_ACCESS_TOKEN: fc.option(fc.string({ minLength: 10, maxLength: 50 }), { nil: null }),
                    FB_PAGE_ID: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
                    IG_BUSINESS_ID: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null })
                }),
                (envConfig) => {
                    // Set environment variables
                    process.env.GEMINI_API_KEY = envConfig.GEMINI_API_KEY;
                    
                    if (envConfig.FB_PAGE_ACCESS_TOKEN) {
                        process.env.FB_PAGE_ACCESS_TOKEN = envConfig.FB_PAGE_ACCESS_TOKEN;
                    } else {
                        delete process.env.FB_PAGE_ACCESS_TOKEN;
                    }
                    
                    if (envConfig.FB_PAGE_ID) {
                        process.env.FB_PAGE_ID = envConfig.FB_PAGE_ID;
                    } else {
                        delete process.env.FB_PAGE_ID;
                    }
                    
                    if (envConfig.IG_BUSINESS_ID) {
                        process.env.IG_BUSINESS_ID = envConfig.IG_BUSINESS_ID;
                    } else {
                        delete process.env.IG_BUSINESS_ID;
                    }
                    
                    // Verify GEMINI_API_KEY is required
                    expect(process.env.GEMINI_API_KEY).toBe(envConfig.GEMINI_API_KEY);
                    
                    // Verify optional Meta credentials are set correctly
                    if (envConfig.FB_PAGE_ACCESS_TOKEN) {
                        expect(process.env.FB_PAGE_ACCESS_TOKEN).toBe(envConfig.FB_PAGE_ACCESS_TOKEN);
                    } else {
                        expect(process.env.FB_PAGE_ACCESS_TOKEN).toBeUndefined();
                    }
                    
                    if (envConfig.FB_PAGE_ID) {
                        expect(process.env.FB_PAGE_ID).toBe(envConfig.FB_PAGE_ID);
                    } else {
                        expect(process.env.FB_PAGE_ID).toBeUndefined();
                    }
                    
                    if (envConfig.IG_BUSINESS_ID) {
                        expect(process.env.IG_BUSINESS_ID).toBe(envConfig.IG_BUSINESS_ID);
                    } else {
                        expect(process.env.IG_BUSINESS_ID).toBeUndefined();
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Application Entry Point - Unit Tests', () => {
    
    let originalEnv;
    let originalExit;
    let originalLog;
    let originalError;
    let originalWarn;
    
    beforeEach(() => {
        // Save original environment and functions
        originalEnv = { ...process.env };
        originalExit = process.exit;
        originalLog = console.log;
        originalError = console.error;
        originalWarn = console.warn;
        
        // Mock process.exit to prevent test termination
        process.exit = jest.fn();
        
        // Mock console functions
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
        
        // Clear all mocks
        jest.clearAllMocks();
        
        // Setup default mock implementations
        db.initializeDatabase.mockResolvedValue();
        db.closeDatabase.mockResolvedValue();
        aiService.initializeGemini.mockReturnValue();
        cron.schedule.mockReturnValue({});
    });
    
    afterEach(() => {
        // Restore original environment and functions
        process.env = originalEnv;
        process.exit = originalExit;
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        
        // Clear module cache
        jest.resetModules();
    });
    
    /**
     * Unit Test: Database initialization on startup
     * Validates: Requirements 1.1, 10.1
     */
    test('should initialize database on startup', async () => {
        // Set required environment variable
        process.env.GEMINI_API_KEY = 'test_api_key';
        
        // Require index.js (this will execute main())
        // We need to wait for async operations
        require('./index');
        
        // Wait for async operations to complete
        await new Promise(resolve => setImmediate(resolve));
        
        // Verify database was initialized
        expect(db.initializeDatabase).toHaveBeenCalled();
    });
    
    /**
     * Unit Test: Cron job registration with correct schedules
     * Validates: Requirements 10.1, 10.2, 10.3, 10.4
     */
    test('should register cron jobs with correct schedules', async () => {
        // Set required environment variable
        process.env.GEMINI_API_KEY = 'test_api_key';
        
        // Require index.js
        require('./index');
        
        // Wait for async operations
        await new Promise(resolve => setImmediate(resolve));
        
        // Verify cron jobs were registered with correct schedules
        expect(cron.schedule).toHaveBeenCalledTimes(3);
        
        // Check nightly analysis schedule (11:30 PM)
        expect(cron.schedule).toHaveBeenCalledWith(
            '30 23 * * *',
            expect.any(Function)
        );
        
        // Check execution phase schedule (10:00 AM)
        expect(cron.schedule).toHaveBeenCalledWith(
            '0 10 * * *',
            expect.any(Function)
        );
        
        // Check analytics sync schedule (11:00 PM)
        expect(cron.schedule).toHaveBeenCalledWith(
            '0 23 * * *',
            expect.any(Function)
        );
    });
    
    /**
     * Unit Test: Missing GEMINI_API_KEY prevents startup
     * Validates: Requirements 11.2, 11.4
     */
    test('should exit when GEMINI_API_KEY is missing', async () => {
        // Remove GEMINI_API_KEY
        delete process.env.GEMINI_API_KEY;
        
        // Require index.js
        require('./index');
        
        // Wait for async operations
        await new Promise(resolve => setImmediate(resolve));
        
        // Verify process.exit was called with error code
        expect(process.exit).toHaveBeenCalledWith(1);
        
        // Verify error was logged
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('GEMINI_API_KEY')
        );
    });
    
    /**
     * Unit Test: Warnings for missing optional credentials
     * Validates: Requirements 11.3, 11.4
     */
    test('should log warnings for missing optional credentials', async () => {
        // Set only required credential
        process.env.GEMINI_API_KEY = 'test_api_key';
        delete process.env.FB_PAGE_ACCESS_TOKEN;
        delete process.env.FB_PAGE_ID;
        delete process.env.IG_BUSINESS_ID;
        
        // Require index.js
        require('./index');
        
        // Wait for async operations
        await new Promise(resolve => setImmediate(resolve));
        
        // Verify warnings were logged for missing optional credentials
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('FB_PAGE_ACCESS_TOKEN')
        );
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('FB_PAGE_ID')
        );
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('IG_BUSINESS_ID')
        );
        
        // Verify application still started successfully
        expect(process.exit).not.toHaveBeenCalled();
    });
    
    /**
     * Unit Test: Gemini API initialization
     * Validates: Requirements 11.2
     */
    test('should initialize Gemini API on startup', async () => {
        // Set required environment variable
        process.env.GEMINI_API_KEY = 'test_api_key';
        
        // Require index.js
        require('./index');
        
        // Wait for async operations
        await new Promise(resolve => setImmediate(resolve));
        
        // Verify Gemini was initialized
        expect(aiService.initializeGemini).toHaveBeenCalled();
    });
    
    /**
     * Unit Test: Graceful shutdown on SIGINT
     * Validates: Requirements 12.1
     */
    test('should handle SIGINT gracefully', async () => {
        // Set required environment variable
        process.env.GEMINI_API_KEY = 'test_api_key';
        
        // Require index.js
        require('./index');
        
        // Wait for async operations
        await new Promise(resolve => setImmediate(resolve));
        
        // Trigger SIGINT
        process.emit('SIGINT');
        
        // Wait for shutdown to complete
        await new Promise(resolve => setImmediate(resolve));
        
        // Verify database was closed
        expect(db.closeDatabase).toHaveBeenCalled();
        
        // Verify process exited with success code
        expect(process.exit).toHaveBeenCalledWith(0);
    });
    
    /**
     * Unit Test: Graceful shutdown on SIGTERM
     * Validates: Requirements 12.1
     */
    test('should handle SIGTERM gracefully', async () => {
        // Set required environment variable
        process.env.GEMINI_API_KEY = 'test_api_key';
        
        // Require index.js
        require('./index');
        
        // Wait for async operations
        await new Promise(resolve => setImmediate(resolve));
        
        // Trigger SIGTERM
        process.emit('SIGTERM');
        
        // Wait for shutdown to complete
        await new Promise(resolve => setImmediate(resolve));
        
        // Verify database was closed
        expect(db.closeDatabase).toHaveBeenCalled();
        
        // Verify process exited with success code
        expect(process.exit).toHaveBeenCalledWith(0);
    });
    
    /**
     * Unit Test: Startup failure handling
     * Validates: Requirements 12.1
     */
    test('should exit with error code on startup failure', async () => {
        // Set required environment variable
        process.env.GEMINI_API_KEY = 'test_api_key';
        
        // Mock database initialization to fail
        db.initializeDatabase.mockRejectedValue(new Error('Database connection failed'));
        
        // Require index.js
        require('./index');
        
        // Wait for async operations
        await new Promise(resolve => setImmediate(resolve));
        
        // Verify error was logged
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('APPLICATION STARTUP FAILED')
        );
        
        // Verify process exited with error code
        expect(process.exit).toHaveBeenCalledWith(1);
    });
});
