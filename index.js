require('dotenv').config();
const cron = require('node-cron');
const { initializeDatabase, closeDatabase } = require('./db');
const { initializeGemini } = require('./services/aiService');
const { nightlyAnalysisPhase, executionPhase, analyticsSyncPhase, runNow } = require('./jobs/dailyManager');

/**
 * AI Social Media Manager - Application Entry Point
 * 
 * Autonomous Node.js application that analyzes historical social media performance data,
 * uses AI to plan content strategy, generates media assets, and automatically publishes
 * content to Facebook and Instagram platforms via the Meta Graph API.
 * 
 * Daily Workflow:
 * - 11:30 PM: Nightly Analysis Phase (analyze historical data, plan tomorrow's content)
 * - 11:35 PM: Execution Phase (generate media, publish content)
 * - 11:00 PM: Analytics Sync Phase (retrieve and update performance metrics)
 * 
 * Requirements: 1.1, 1.5, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.4, 12.1
 */

/**
 * Validate critical environment variables
 * Requirements: 11.2, 11.4
 */
function validateEnvironment() {
    console.log('→ Validating environment configuration...');
    
    // Critical: GEMINI_API_KEY is required
    if (!process.env.GEMINI_API_KEY) {
        console.error('✗ GEMINI_API_KEY environment variable is required');
        console.error('  Please set GEMINI_API_KEY in your .env file');
        process.exit(1);
    }
    
    // Optional: Meta API credentials (warn if missing)
    if (!process.env.FB_PAGE_ACCESS_TOKEN) {
        console.warn('⚠ FB_PAGE_ACCESS_TOKEN not configured - Facebook publishing will be simulated');
    }
    
    if (!process.env.FB_PAGE_ID) {
        console.warn('⚠ FB_PAGE_ID not configured - Facebook publishing will be simulated');
    }
    
    if (!process.env.IG_BUSINESS_ID) {
        console.warn('⚠ IG_BUSINESS_ID not configured - Instagram publishing will be simulated');
    }
    
    console.log('✓ Environment validation complete');
}

/**
 * Register cron jobs for daily workflow phases
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
function registerCronJobs() {
    console.log('→ Registering cron jobs...');
    
    // Nightly Analysis Phase: 11:30 PM daily
    cron.schedule('30 23 * * *', () => {
        nightlyAnalysisPhase();
    });
    console.log('✓ Registered: Nightly Analysis Phase at 11:30 PM (30 23 * * *)');
    
    // Execution Phase: 11:35 PM daily
    cron.schedule('35 23 * * *', () => {
        executionPhase();
    });
    console.log('✓ Registered: Execution Phase at 11:35 PM (35 23 * * *)');
    
    // Analytics Sync Phase: 11:00 PM daily
    cron.schedule('0 23 * * *', () => {
        analyticsSyncPhase();
    });
    console.log('✓ Registered: Analytics Sync Phase at 11:00 PM (0 23 * * *)');
    
    console.log('✓ All cron jobs registered successfully');
}

/**
 * Graceful shutdown handler
 * Requirements: 12.1
 */
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        console.log('');
        console.log(`→ Received ${signal} - shutting down gracefully...`);
        
        try {
            // Close database connection
            await closeDatabase();
            
            console.log('✓ Shutdown complete');
            process.exit(0);
        } catch (error) {
            console.error('✗ Error during shutdown:', error.message);
            process.exit(1);
        }
    };
    
    // Handle termination signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Main application initialization
 */
async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  AI SOCIAL MEDIA MANAGER');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    try {
        // Step 1: Load and validate environment configuration
        validateEnvironment();
        console.log('');
        
        // Step 2: Initialize database
        await initializeDatabase();
        console.log('');
        
        // Step 3: Initialize AI service
        initializeGemini();
        console.log('');
        
        // Step 4: Register cron jobs for daily workflow
        registerCronJobs();
        console.log('');
        
        // Step 5: Setup graceful shutdown
        setupGracefulShutdown();
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✓ APPLICATION STARTED SUCCESSFULLY');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log('Scheduled Tasks:');
        console.log('  • Nightly Analysis: 11:30 PM daily');
        console.log('  • Content Execution: 11:35 PM daily');
        console.log('  • Analytics Sync: 11:00 PM daily');
        console.log('');
        console.log('Press Ctrl+C to stop the application');
        console.log('');
        
        // Keep the process alive
        // The cron jobs will run in the background
        
    } catch (error) {
        console.error('');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('✗ APPLICATION STARTUP FAILED');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('Error:', error.message);
        console.error(error.stack);
        console.error('');
        process.exit(1);
    }
}

/**
 * Manual phase runner for testing without waiting for cron schedule.
 * Usage:
 *   node index.js --run nightly
 *   node index.js --run execute
 *   node index.js --run analytics
 */
async function runPhaseNow() {
    const phaseArg = process.argv[process.argv.indexOf('--run') + 1];
    const phases = {
        nightly: { fn: nightlyAnalysisPhase, label: 'Nightly Analysis Phase' },
        execute: { fn: executionPhase, label: 'Execution Phase' },
        analytics: { fn: analyticsSyncPhase, label: 'Analytics Sync Phase' },
        now: { fn: runNow, label: 'Immediate AI Post' },
    };

    const phase = phases[phaseArg];
    if (!phase) {
        console.error(`✗ Unknown phase "${phaseArg}". Use: nightly | execute | analytics`);
        process.exit(1);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  MANUAL RUN: ${phase.label}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    try {
        validateEnvironment();
        await initializeDatabase();
        initializeGemini();
        await phase.fn();
        console.log('');
        console.log(`✓ ${phase.label} completed`);
    } catch (error) {
        console.error(`✗ ${phase.label} failed:`, error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Small delay to let SQLite flush any pending async callbacks
        await new Promise(r => setTimeout(r, 200));
        const { closeDatabase } = require('./db');
        await closeDatabase();
        process.exit(0);
    }
}

// Start the application
if (process.argv.includes('--run')) {
    runPhaseNow();
} else {
    main();
}
