# Requirements Document

## Introduction

The AI Social Media Manager is an autonomous Node.js application that analyzes historical social media performance data, uses AI to plan content strategy, generates media assets, and automatically publishes content to Facebook and Instagram platforms via the Meta Graph API. The system operates on a daily schedule with three distinct phases: nightly analysis and planning, morning execution and publishing, and evening analytics synchronization.

## Glossary

- **System**: The AI Social Media Manager application
- **Gemini_API**: Google Gemini 1.5 Flash AI model accessed via @google/generative-ai SDK or HTTP
- **Meta_Graph_API**: Facebook and Instagram Graph API for publishing and retrieving insights
- **Post_History_Database**: SQLite database storing post records and performance metrics
- **Scheduler**: node-cron job scheduler managing daily workflow phases
- **Media_Generator**: Service generating images via Pollinations.ai API
- **Content_Plan**: AI-generated specification for next day's post including format, topic, caption, and media prompt
- **Performance_Metrics**: Quantitative data including likes and reach for published posts
- **Post_Format**: Type of social media content - 'post', 'reel', or 'story'
- **Platform**: Target social media platform - 'facebook', 'instagram', or 'both'

## Requirements

### Requirement 1: Database Initialization

**User Story:** As a system administrator, I want the application to initialize the SQLite database on startup, so that post history and metrics can be persisted.

#### Acceptance Criteria

1. WHEN the System starts, THE System SHALL create a Post_History_Database if it does not exist
2. THE Post_History_Database SHALL contain a table named post_history with columns: id, target_date, platform, format, topic, caption, media_url, likes, reach, ai_analysis, and status
3. THE System SHALL set default values of 0 for likes and reach columns
4. THE System SHALL use INTEGER PRIMARY KEY AUTOINCREMENT for the id column
5. THE System SHALL log successful database initialization to the console

### Requirement 2: Historical Data Retrieval

**User Story:** As the AI planning system, I want to retrieve the last 7 days of published posts with their metrics, so that I can analyze performance patterns.

#### Acceptance Criteria

1. WHEN the nightly analysis phase executes, THE System SHALL query the Post_History_Database for posts with status 'published' from the last 7 days
2. THE System SHALL retrieve all columns including Performance_Metrics for each post
3. WHEN no historical data exists, THE System SHALL return an empty dataset
4. THE System SHALL log the number of historical records retrieved to the console

### Requirement 3: AI Content Planning

**User Story:** As a content strategist, I want the AI to analyze past performance and plan tomorrow's content, so that the strategy is data-driven and optimized.

#### Acceptance Criteria

1. WHEN the nightly analysis phase executes at 11:30 PM, THE System SHALL send historical post data to the Gemini_API
2. THE System SHALL request the Gemini_API to return a Content_Plan in strict JSON format
3. THE Content_Plan SHALL include fields: format, topic, caption, media_prompt, and ai_analysis
4. THE System SHALL validate that the returned format is one of 'post', 'reel', or 'story'
5. THE System SHALL log the AI reasoning to the console
6. WHEN the Gemini_API returns invalid JSON, THE System SHALL log an error and retry once

### Requirement 4: Content Plan Persistence

**User Story:** As the publishing system, I want planned content saved to the database, so that it can be executed the next day.

#### Acceptance Criteria

1. WHEN a Content_Plan is generated, THE System SHALL insert a new record into the Post_History_Database
2. THE System SHALL set target_date to tomorrow's date
3. THE System SHALL set status to 'planned'
4. THE System SHALL set platform based on the Post_Format (posts and stories to 'both', reels to 'instagram')
5. THE System SHALL log successful plan persistence with the record id to the console

### Requirement 5: Image Generation

**User Story:** As the media production system, I want to generate images for posts and stories, so that visual content is available for publishing.

#### Acceptance Criteria

1. WHEN the Post_Format is 'post' or 'story', THE Media_Generator SHALL construct a Pollinations.ai API URL using the media_prompt
2. THE Media_Generator SHALL return the generated image URL
3. THE System SHALL store the media URL in the Post_History_Database
4. THE System SHALL log the generated media URL to the console
5. WHEN the Post_Format is 'reel', THE Media_Generator SHALL return a placeholder video URL or skip media generation

### Requirement 6: Facebook Post Publishing

**User Story:** As a social media manager, I want posts automatically published to Facebook, so that content reaches the Facebook audience.

#### Acceptance Criteria

1. WHEN the execution phase runs at 10:00 AM and Platform is 'facebook' or 'both', THE System SHALL publish the post to Facebook via Meta_Graph_API
2. THE System SHALL use the FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN from environment variables
3. THE System SHALL send the caption and media_url to the appropriate Graph API endpoint
4. WHEN the Meta_Graph_API returns success, THE System SHALL log the post ID to the console
5. WHEN FB_PAGE_ACCESS_TOKEN is missing, THE System SHALL log a warning and simulate successful publishing

### Requirement 7: Instagram Post Publishing

**User Story:** As a social media manager, I want posts automatically published to Instagram, so that content reaches the Instagram audience.

#### Acceptance Criteria

1. WHEN the execution phase runs at 10:00 AM and Platform is 'instagram' or 'both', THE System SHALL publish the post to Instagram via Meta_Graph_API
2. THE System SHALL use the IG_BUSINESS_ID and FB_PAGE_ACCESS_TOKEN from environment variables
3. THE System SHALL handle different endpoints for Post_Format types (posts, reels, stories)
4. WHEN the Meta_Graph_API returns success, THE System SHALL log the creation ID to the console
5. WHEN IG_BUSINESS_ID is missing, THE System SHALL log a warning and simulate successful publishing

### Requirement 8: Publication Status Update

**User Story:** As the system, I want to update post status after publishing, so that the database reflects the current state.

#### Acceptance Criteria

1. WHEN a post is successfully published to any Platform, THE System SHALL update the status column to 'published' in the Post_History_Database
2. WHEN publishing fails, THE System SHALL update the status column to 'failed'
3. THE System SHALL log the status update to the console
4. THE System SHALL include error details in the log when status is 'failed'

### Requirement 9: Analytics Synchronization

**User Story:** As a performance analyst, I want post metrics retrieved from social platforms, so that the AI can learn from actual performance data.

#### Acceptance Criteria

1. WHEN the analytics sync phase executes at 11:00 PM, THE System SHALL query Meta_Graph_API for insights of recently published posts
2. THE System SHALL retrieve likes and reach metrics for each post
3. THE System SHALL update the likes and reach columns in the Post_History_Database
4. THE System SHALL log the updated metrics for each post to the console
5. WHEN Meta_Graph_API credentials are missing, THE System SHALL log a warning and skip synchronization

### Requirement 10: Daily Workflow Scheduling

**User Story:** As a system operator, I want the application to run autonomously on a daily schedule, so that no manual intervention is required.

#### Acceptance Criteria

1. WHEN the System starts, THE Scheduler SHALL register three cron jobs for the daily workflow phases
2. THE Scheduler SHALL execute the nightly analysis phase at 11:30 PM daily
3. THE Scheduler SHALL execute the execution phase at 10:00 AM daily
4. THE Scheduler SHALL execute the analytics sync phase at 11:00 PM daily
5. THE System SHALL log the start and completion of each phase to the console

### Requirement 11: Environment Configuration

**User Story:** As a system administrator, I want to configure API credentials via environment variables, so that sensitive data is not hardcoded.

#### Acceptance Criteria

1. WHEN the System starts, THE System SHALL load environment variables from a .env file using dotenv
2. THE System SHALL read GEMINI_API_KEY for Gemini_API authentication
3. THE System SHALL read FB_PAGE_ACCESS_TOKEN, FB_PAGE_ID, and IG_BUSINESS_ID for Meta_Graph_API authentication
4. WHEN required environment variables are missing, THE System SHALL log warnings for affected features
5. THE System SHALL include a sample .env.example file with placeholder values

### Requirement 12: Error Handling and Logging

**User Story:** As a system operator, I want comprehensive error handling and logging, so that I can diagnose issues and monitor system health.

#### Acceptance Criteria

1. THE System SHALL use try-catch blocks for all asynchronous operations
2. WHEN an error occurs, THE System SHALL log the error message and stack trace to the console
3. THE System SHALL log the start of each major operation with descriptive messages
4. THE System SHALL log the completion of each major operation with success indicators
5. THE System SHALL continue operation after non-critical errors without terminating the process

### Requirement 13: Modular Service Architecture

**User Story:** As a developer, I want the codebase organized into modular services, so that the system is maintainable and testable.

#### Acceptance Criteria

1. THE System SHALL implement database operations in a dedicated db.js module
2. THE System SHALL implement Gemini_API interactions in services/aiService.js
3. THE System SHALL implement Meta_Graph_API interactions in services/metaService.js
4. THE System SHALL implement Media_Generator logic in services/mediaService.js
5. THE System SHALL implement daily workflow logic in jobs/dailyManager.js
6. THE System SHALL use index.js as the entry point that initializes and coordinates all modules
