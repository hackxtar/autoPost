const { 
    getHistoricalPosts, 
    getRecentTopics, 
    insertContentPlan, 
    getTodaysPlannedPost, 
    updatePostStatus,
    getDatabase
} = require('../db');
const { generateContentPlan } = require('../services/aiService');
const { publishToFacebook, publishToInstagram } = require('../services/metaService');

/**
 * Daily Manager - Workflow Phases
 * 
 * Manages the high-level phases of the daily autonomous workflow.
 */

// ─── Nightly Analysis Phase ──────────────────────────────────────────────────

async function nightlyAnalysisPhase() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('→ NIGHTLY ANALYSIS PHASE STARTED');
    console.log('═══════════════════════════════════════════════════════════');

    try {
        // 1. Retrieve performance data from the last 7 days
        const historicalPosts = await getHistoricalPosts(7);

        // 2. Retrieve recent topics to avoid repetition
        const recentTopics = await getRecentTopics(14);

        // 3. Use AI to generate tomorrow's content plan
        console.log('→ Generating AI content strategy...');
        const plan = await generateContentPlan(historicalPosts, recentTopics);

        // 4. Store the plan in the database
        await insertContentPlan(plan);

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✓ NIGHTLY ANALYSIS PHASE COMPLETED - New plan stored');
        console.log('═══════════════════════════════════════════════════════════\n');
    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════════════');
        console.error('✗ NIGHTLY ANALYSIS PHASE FAILED');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('Error:', error.message);
        console.log('⚠ System will continue — retry on next cycle\n');
    }
}

// ─── Execution Phase ──────────────────────────────────────────────────────────

async function executionPhase() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('→ EXECUTION PHASE STARTED');
    console.log('═══════════════════════════════════════════════════════════');

    try {
        const plannedPost = await getTodaysPlannedPost();

        if (!plannedPost) {
            console.log('✓ EXECUTION PHASE COMPLETED - No planned post for today (skipping)');
            console.log('═══════════════════════════════════════════════════════════\n');
            return;
        }

        console.log(`→ Post ID ${plannedPost.id} | Format: ${plannedPost.format} | Platform: ${plannedPost.platform}`);
        console.log(`  Topic: ${plannedPost.topic}`);

        const publishResults = [];

        try {
            if (plannedPost.platform === 'facebook' || plannedPost.platform === 'both') {
                const fbResult = await publishToFacebook(plannedPost.caption);
                publishResults.push({ platform: 'facebook', id: fbResult.id });
            }

            if (plannedPost.platform === 'instagram' || plannedPost.platform === 'both') {
                const igResult = await publishToInstagram(plannedPost.format, plannedPost.caption);
                publishResults.push({ platform: 'instagram', id: igResult.id });
            }

            await updatePostStatus(plannedPost.id, 'published');

            console.log('\n═══════════════════════════════════════════════════════════');
            console.log(`✓ EXECUTION PHASE COMPLETED - Post ID: ${plannedPost.id}`);
            console.log(`  Published to: ${publishResults.map(r => r.platform).join(', ')}`);
            console.log('═══════════════════════════════════════════════════════════\n');

        } catch (publishError) {
            await updatePostStatus(plannedPost.id, 'failed', publishError.message);
            throw publishError;
        }

    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════════════');
        console.error('✗ EXECUTION PHASE FAILED');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('Error:', error.message);
        console.log('⚠ System will continue — retry on next cycle\n');
    }
}

// ─── Analytics Sync Phase ─────────────────────────────────────────────────────

async function analyticsSyncPhase() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('→ ANALYTICS SYNC PHASE STARTED');
    console.log('═══════════════════════════════════════════════════════════');

    try {
        const db = getDatabase();
        
        // Find published posts from last 3 days to sync metrics
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 3);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        await new Promise((resolve, reject) => {
            db.all(
                `SELECT id FROM post_history WHERE status = 'published' AND target_date >= ?`,
                [cutoffDateStr],
                async (err, rows) => {
                    if (err) return reject(err);

                    console.log(`→ Syncing metrics for ${rows.length} recent posts...`);
                    
                    // In a real implementation, we would call the Meta API here.
                    // For now, we simulate success for all found posts.
                    
                    console.log('\n═══════════════════════════════════════════════════════════');
                    console.log('✓ ANALYTICS SYNC PHASE COMPLETED');
                    console.log('═══════════════════════════════════════════════════════════\n');
                    resolve();
                }
            );
        });
    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════════════');
        console.error('✗ ANALYTICS SYNC PHASE FAILED');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('Error:', error.message);
        console.log('⚠ System will continue\n');
    }
}

// ─── runNow ───────────────────────────────────────────────────────────────────

/**
 * Immediate AI Post generation and publishing.
 * Used for testing and on-demand content creation.
 */
async function runNow() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('→ RUN NOW: IMMEDIATE AI POST');
    console.log('═══════════════════════════════════════════════════════════');

    try {
        // 1. Plan
        const historicalPosts = await getHistoricalPosts(14);
        const recentTopics = await getRecentTopics(14);
        const plan = await generateContentPlan(historicalPosts, recentTopics);
        
        // 2. Store with TODAY's date (override tomorrow default)
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        const db = getDatabase();
        const platform = plan.format === 'reel' ? 'instagram' : 'both';
        
        const insertedId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO post_history 
                (target_date, platform, format, topic, caption, media_prompt, ai_analysis, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    todayStr,
                    platform,
                    plan.format,
                    plan.topic,
                    plan.caption,
                    plan.media_prompt || null,
                    plan.ai_analysis,
                    'planned'
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });

        console.log(`✓ Planned immediate post (ID: ${insertedId})`);

        // 3. Execute
        await executionPhase();

    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════════════');
        console.error('✗ RUN NOW FAILED');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('Error:', error.message);
    }
}

module.exports = {
    nightlyAnalysisPhase,
    executionPhase,
    analyticsSyncPhase,
    runNow
};
