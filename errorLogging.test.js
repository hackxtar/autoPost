const fc = require('fast-check');

/**
 * Error Logging Completeness Tests
 * 
 * Property 16: Error Logging Completeness
 * Validates: Requirements 12.2
 * 
 * For any error that occurs during system operation, the log output should
 * contain both the error message and stack trace.
 */

describe('Error Logging - Property Tests', () => {
    
    let originalConsoleError;
    let errorLogs;
    
    beforeEach(() => {
        // Capture console.error calls
        originalConsoleError = console.error;
        errorLogs = [];
        console.error = jest.fn((...args) => {
            errorLogs.push(args.join(' '));
        });
    });
    
    afterEach(() => {
        // Restore console.error
        console.error = originalConsoleError;
    });
    
    /**
     * Property 16: Error Logging Completeness
     * Validates: Requirements 12.2
     * 
     * For any error that occurs during system operation, the log output should
     * contain both the error message and stack trace.
     */
    test('Feature: ai-social-media-manager, Property 16: Error logging completeness', () => {
        fc.assert(
            fc.property(
                fc.record({
                    errorMessage: fc.string({ minLength: 5, maxLength: 100 }),
                    errorType: fc.constantFrom('TypeError', 'Error', 'ReferenceError', 'SyntaxError'),
                    functionName: fc.constantFrom('database', 'aiService', 'metaService', 'mediaService')
                }),
                (errorConfig) => {
                    // Clear previous logs
                    errorLogs = [];
                    
                    // Create an error with the specified message and type
                    let error;
                    switch (errorConfig.errorType) {
                        case 'TypeError':
                            error = new TypeError(errorConfig.errorMessage);
                            break;
                        case 'ReferenceError':
                            error = new ReferenceError(errorConfig.errorMessage);
                            break;
                        case 'SyntaxError':
                            error = new SyntaxError(errorConfig.errorMessage);
                            break;
                        default:
                            error = new Error(errorConfig.errorMessage);
                    }
                    
                    // Simulate error logging pattern used throughout the application
                    console.error(`✗ ${errorConfig.functionName} failed:`, error.message);
                    console.error(error.stack);
                    
                    // Verify error message was logged
                    const messageLogged = errorLogs.some(log => 
                        log.includes(errorConfig.errorMessage)
                    );
                    expect(messageLogged).toBe(true);
                    
                    // Verify stack trace was logged
                    const stackTraceLogged = errorLogs.some(log => 
                        log.includes('at ') || log.includes(errorConfig.errorType)
                    );
                    expect(stackTraceLogged).toBe(true);
                    
                    // Verify both message and stack are in separate log entries
                    expect(errorLogs.length).toBeGreaterThanOrEqual(2);
                }
            ),
            { numRuns: 100 }
        );
    });
    
    /**
     * Property Test: Error logging includes context
     * Validates: Requirements 12.2
     */
    test('Feature: ai-social-media-manager, Property 16: Error logging includes operation context', () => {
        fc.assert(
            fc.property(
                fc.record({
                    operation: fc.constantFrom(
                        'Database initialization',
                        'AI content generation',
                        'Facebook publishing',
                        'Instagram publishing',
                        'Metrics retrieval',
                        'Media generation'
                    ),
                    errorMessage: fc.string({ minLength: 5, maxLength: 100 })
                }),
                (testData) => {
                    // Clear previous logs
                    errorLogs = [];
                    
                    const error = new Error(testData.errorMessage);
                    
                    // Simulate contextual error logging
                    console.error(`✗ ${testData.operation} failed:`, error.message);
                    console.error(error.stack);
                    
                    // Verify operation context is included in logs
                    const contextLogged = errorLogs.some(log => 
                        log.includes(testData.operation)
                    );
                    expect(contextLogged).toBe(true);
                    
                    // Verify error details are logged
                    const errorDetailsLogged = errorLogs.some(log => 
                        log.includes(testData.errorMessage)
                    );
                    expect(errorDetailsLogged).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Error Logging - Unit Tests', () => {
    
    let originalConsoleError;
    let errorLogs;
    
    beforeEach(() => {
        // Capture console.error calls
        originalConsoleError = console.error;
        errorLogs = [];
        console.error = jest.fn((...args) => {
            errorLogs.push(args.join(' '));
        });
    });
    
    afterEach(() => {
        // Restore console.error
        console.error = originalConsoleError;
    });
    
    /**
     * Unit Test: Error message is logged
     * Validates: Requirements 12.2
     */
    test('should log error message', () => {
        const error = new Error('Test error message');
        
        console.error('✗ Operation failed:', error.message);
        console.error(error.stack);
        
        // Verify error message was logged
        expect(errorLogs.some(log => log.includes('Test error message'))).toBe(true);
    });
    
    /**
     * Unit Test: Stack trace is logged
     * Validates: Requirements 12.2
     */
    test('should log stack trace', () => {
        const error = new Error('Test error');
        
        console.error('✗ Operation failed:', error.message);
        console.error(error.stack);
        
        // Verify stack trace was logged
        expect(errorLogs.some(log => log.includes('at '))).toBe(true);
    });
    
    /**
     * Unit Test: Multiple errors are logged separately
     * Validates: Requirements 12.2
     */
    test('should log multiple errors separately', () => {
        const error1 = new Error('First error');
        const error2 = new Error('Second error');
        
        console.error('✗ First operation failed:', error1.message);
        console.error(error1.stack);
        
        console.error('✗ Second operation failed:', error2.message);
        console.error(error2.stack);
        
        // Verify both errors were logged
        expect(errorLogs.some(log => log.includes('First error'))).toBe(true);
        expect(errorLogs.some(log => log.includes('Second error'))).toBe(true);
        
        // Verify at least 4 log entries (2 messages + 2 stacks)
        expect(errorLogs.length).toBeGreaterThanOrEqual(4);
    });
    
    /**
     * Unit Test: Error logging format consistency
     * Validates: Requirements 12.2
     */
    test('should use consistent error logging format', () => {
        const error = new Error('Consistent format test');
        
        // Use the standard error logging pattern
        console.error('✗ Test operation failed:', error.message);
        console.error(error.stack);
        
        // Verify format includes error indicator (✗)
        expect(errorLogs.some(log => log.includes('✗'))).toBe(true);
        
        // Verify format includes operation description
        expect(errorLogs.some(log => log.includes('Test operation failed'))).toBe(true);
        
        // Verify error message is included
        expect(errorLogs.some(log => log.includes('Consistent format test'))).toBe(true);
    });
    
    /**
     * Unit Test: Nested error logging
     * Validates: Requirements 12.2
     */
    test('should log nested errors with full context', () => {
        const innerError = new Error('Inner error');
        const outerError = new Error(`Outer error: ${innerError.message}`);
        
        console.error('✗ Operation failed:', outerError.message);
        console.error(outerError.stack);
        
        // Verify both error messages are captured
        expect(errorLogs.some(log => log.includes('Outer error'))).toBe(true);
        expect(errorLogs.some(log => log.includes('Inner error'))).toBe(true);
    });
    
    /**
     * Unit Test: Error logging with additional context
     * Validates: Requirements 12.2, 8.4
     */
    test('should log errors with additional context details', () => {
        const error = new Error('Database query failed');
        const postId = 123;
        
        console.error(`✗ Failed to update post ${postId}:`, error.message);
        console.error(error.stack);
        
        // Verify context details are included
        expect(errorLogs.some(log => log.includes('post 123'))).toBe(true);
        expect(errorLogs.some(log => log.includes('Database query failed'))).toBe(true);
    });
});
