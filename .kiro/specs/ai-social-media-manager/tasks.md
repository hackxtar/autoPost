# Implementation Plan: AI Social Media Manager

## Overview

This implementation plan breaks down the AI Social Media Manager into discrete coding tasks. The system will be built incrementally, starting with core infrastructure (database and configuration), then implementing service modules (AI, Meta, Media), followed by workflow orchestration, and finally the application entry point. Each task builds on previous work, with testing integrated throughout to validate functionality early.

## Tasks

- [x] 1. Project setup and configuration
  - Initialize Node.js project with package.json
  - Install dependencies: sqlite3, @google/generative-ai, axios, node-cron, dotenv
  - Create .env.example with placeholder values for all required environment variables
  - Create .gitignore to exclude .env and node_modules
  - _Requirements: 11.1, 11.5_

- [x] 2. Implement database module (db.js)
  - [x] 2.1 Create database initialization and schema
    - Implement initializeDatabase() function to create SQLite database
    - Define post_history table schema with all required columns
    - Set up default values for likes and reach columns (0)
    - Add database connection management
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.2 Write property test for default metrics initialization
    - **Property 1: Default Metrics Initialization**
    - **Validates: Requirements 1.3**
  
  - [x] 2.3 Implement historical data retrieval
    - Create getHistoricalPosts(days) function to query posts from last N days
    - Filter by status 'published'
    - Return all columns including metrics
    - Handle empty result case
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 2.4 Write property test for historical query filtering
    - **Property 2: Historical Query Filtering**
    - **Validates: Requirements 2.1**
  
  - [x] 2.5 Write property test for complete column retrieval
    - **Property 3: Complete Column Retrieval**
    - **Validates: Requirements 2.2**
  
  - [x] 2.6 Implement content plan persistence
    - Create insertContentPlan(plan) function to insert new records
    - Set status to 'planned' by default
    - Calculate and set target_date to tomorrow
    - Derive platform from format
    - Return inserted record ID
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 2.7 Write property test for content plan persistence
    - **Property 6: Content Plan Persistence**
    - **Validates: Requirements 4.1, 4.3**
  
  - [x] 2.8 Write property test for target date calculation
    - **Property 7: Target Date Calculation**
    - **Validates: Requirements 4.2**
  
  - [x] 2.9 Write property test for platform derivation
    - **Property 8: Platform Derivation from Format**
    - **Validates: Requirements 4.4**
  
  - [x] 2.10 Implement post status and metrics updates
    - Create updatePostStatus(id, status, errorDetails) function
    - Create updatePostMetrics(id, likes, reach) function
    - Create getTodaysPlannedPost() function to retrieve today's planned content
    - Add logging for all database operations
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.3, 9.4_
  
  - [x] 2.11 Write property test for status update reflects publish outcome
    - **Property 14: Status Update Reflects Publish Outcome**
    - **Validates: Requirements 8.1, 8.2**
  
  - [x] 2.12 Write property test for metrics synchronization round trip
    - **Property 15: Metrics Synchronization Round Trip**
    - **Validates: Requirements 9.2, 9.3**

- [x] 3. Checkpoint - Verify database module
  - Ensure all database tests pass, ask the user if questions arise.

- [x] 4. Implement AI service (services/aiService.js)
  - [x] 4.1 Create Gemini API integration
    - Initialize @google/generative-ai SDK with GEMINI_API_KEY
    - Implement generateContentPlan(historicalPosts) function
    - Format historical data into AI prompt
    - Request JSON response with required fields
    - Parse and return content plan
    - _Requirements: 3.1, 3.2, 11.2_
  
  - [x] 4.2 Implement content plan validation
    - Create validateContentPlan(plan) function
    - Check for required fields: format, topic, caption, media_prompt, ai_analysis
    - Validate format is one of 'post', 'reel', or 'story'
    - Return validated plan or throw error
    - _Requirements: 3.3, 3.4_
  
  - [x] 4.3 Write property test for content plan structure validation
    - **Property 4: Content Plan Structure Validation**
    - **Validates: Requirements 3.2, 3.3**
  
  - [x] 4.4 Write property test for format enumeration validation
    - **Property 5: Format Enumeration Validation**
    - **Validates: Requirements 3.4**
  
  - [x] 4.5 Add error handling and retry logic
    - Wrap API calls in try-catch blocks
    - Implement retry logic for invalid JSON responses (1 retry)
    - Log AI reasoning and errors
    - _Requirements: 3.5, 3.6, 12.1, 12.2_
  
  - [x] 4.6 Write unit tests for AI service error handling
    - Test invalid JSON response triggers retry
    - Test retry exhaustion throws error
    - Test error logging includes stack trace
    - _Requirements: 3.6, 12.2_

- [x] 5. Implement media service (services/mediaService.js)
  - [x] 5.1 Create Pollinations.ai integration
    - Implement generateMedia(format, prompt) function
    - Construct Pollinations.ai URL with encoded prompt
    - Handle format-specific logic (posts, stories get images; reels get placeholder)
    - Return media URL
    - Log generated URLs
    - _Requirements: 5.1, 5.2, 5.4, 5.5_
  
  - [x] 5.2 Write property test for media URL generation
    - **Property 9: Media URL Generation for Visual Formats**
    - **Validates: Requirements 5.1, 5.2**
  
  - [x] 5.3 Write unit tests for media service
    - Test URL encoding of prompts
    - Test format-specific handling
    - Test placeholder for reels
    - _Requirements: 5.5_

- [x] 6. Implement Meta service (services/metaService.js)
  - [x] 6.1 Create Facebook publishing function
    - Implement publishToFacebook(caption, mediaUrl) function
    - Use FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN from environment
    - Construct Graph API request to /{page-id}/photos or /feed endpoint
    - Handle missing credentials with warning and simulation
    - Return post ID
    - Log publish results
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 11.3_
  
  - [x] 6.2 Write property test for platform-based publishing routing
    - **Property 11: Platform-Based Publishing Routing**
    - **Validates: Requirements 6.1, 7.1**
  
  - [x] 6.3 Write property test for API payload completeness
    - **Property 12: API Payload Completeness**
    - **Validates: Requirements 6.3**
  
  - [x] 6.4 Create Instagram publishing function
    - Implement publishToInstagram(format, caption, mediaUrl) function
    - Use IG_BUSINESS_ID and FB_PAGE_ACCESS_TOKEN from environment
    - Route to correct endpoint based on format (posts, reels, stories)
    - Handle missing credentials with warning and simulation
    - Return creation ID
    - Log publish results
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.3_
  
  - [x] 6.5 Write property test for format-specific Instagram endpoints
    - **Property 13: Format-Specific Instagram Endpoints**
    - **Validates: Requirements 7.3**
  
  - [x] 6.6 Create metrics retrieval functions
    - Implement getPostMetrics(postId, platform) function
    - Query Meta Graph API insights endpoint for likes and reach
    - Implement syncRecentMetrics() function to update database
    - Handle missing credentials with warning
    - Log retrieved metrics
    - _Requirements: 9.1, 9.2, 9.4, 9.5_
  
  - [x] 6.7 Write unit tests for Meta service error handling
    - Test missing credentials trigger warnings
    - Test API failures are logged
    - Test simulated publishing when credentials missing
    - _Requirements: 6.5, 7.5, 9.5, 12.1, 12.2_

- [x] 7. Checkpoint - Verify service modules
  - Ensure all service tests pass, ask the user if questions arise.

- [x] 8. Implement daily workflow orchestration (jobs/dailyManager.js)
  - [x] 8.1 Create nightly analysis phase
    - Implement nightlyAnalysisPhase() function
    - Retrieve historical posts from database (last 7 days)
    - Send to AI service for content plan generation
    - Persist content plan to database
    - Log phase start and completion
    - Handle errors without terminating process
    - _Requirements: 2.1, 3.1, 4.1, 10.2, 10.5, 12.3, 12.5_
  
  - [x] 8.2 Create execution phase
    - Implement executionPhase() function
    - Retrieve today's planned post from database
    - Generate media via media service
    - Publish to appropriate platforms via Meta service
    - Update post status to 'published' or 'failed'
    - Log phase start and completion
    - Handle errors without terminating process
    - _Requirements: 5.1, 5.3, 6.1, 7.1, 8.1, 8.2, 10.3, 10.5, 12.3, 12.5_
  
  - [x] 8.3 Write property test for media URL persistence
    - **Property 10: Media URL Persistence**
    - **Validates: Requirements 5.3**
  
  - [x] 8.4 Create analytics sync phase
    - Implement analyticsSyncPhase() function
    - Query recently published posts (last 2 days)
    - Retrieve metrics from Meta service
    - Update database with likes and reach
    - Log phase start and completion
    - Handle errors without terminating process
    - _Requirements: 9.1, 9.2, 9.3, 10.4, 10.5, 12.3, 12.5_
  
  - [x] 8.5 Write property test for operation lifecycle logging
    - **Property 17: Operation Lifecycle Logging**
    - **Validates: Requirements 10.5, 12.3, 12.4**
  
  - [x] 8.6 Write property test for non-critical error resilience
    - **Property 18: Non-Critical Error Resilience**
    - **Validates: Requirements 12.5**
  
  - [x] 8.7 Write integration tests for daily workflow
    - Test end-to-end nightly → execution → analytics flow
    - Test database persistence across phases
    - Test error recovery in each phase
    - _Requirements: 10.2, 10.3, 10.4_

- [x] 9. Implement application entry point (index.js)
  - [x] 9.1 Create initialization sequence
    - Load dotenv configuration
    - Validate critical environment variables (GEMINI_API_KEY)
    - Initialize database schema
    - Log startup status
    - _Requirements: 11.1, 11.2, 11.4, 1.1, 1.5_
  
  - [x] 9.2 Register cron jobs
    - Register nightly analysis phase at '30 23 * * *' (11:30 PM)
    - Register execution phase at '0 10 * * *' (10:00 AM)
    - Register analytics sync phase at '0 23 * * *' (11:00 PM)
    - Log cron job registration
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [x] 9.3 Write property test for configuration usage consistency
    - **Property 19: Configuration Usage Consistency**
    - **Validates: Requirements 11.2, 11.3, 6.2, 7.2**
  
  - [x] 9.4 Add graceful shutdown handling
    - Handle SIGINT and SIGTERM signals
    - Close database connections
    - Log shutdown status
    - _Requirements: 12.1_
  
  - [x] 9.5 Write unit tests for application initialization
    - Test database initialization on startup
    - Test cron job registration with correct schedules
    - Test missing GEMINI_API_KEY prevents startup
    - Test warnings for missing optional credentials
    - _Requirements: 1.1, 10.1, 11.4_

- [x] 10. Final checkpoint and integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Write property test for error logging completeness
  - **Property 16: Error Logging Completeness**
  - **Validates: Requirements 12.2**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation uses JavaScript/Node.js as specified in the design document
- Property tests validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- Integration tests ensure end-to-end workflow functionality
- All API integrations include error handling and graceful degradation
- The system continues operation after non-critical errors
