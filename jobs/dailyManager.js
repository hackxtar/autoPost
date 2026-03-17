const { getHistoricalPosts, getRecentTopics, insertContentPlan, getTodaysPlannedPost, updatePostStatus, updatePostMetrics, getDatabase } = require('../db');
const { generateContentPlan } = require('../services/aiService');
const { publishToFacebook, publishToInstagram, getPostMetrics } = require('../services/metaService');

/**
 * Daily Workflow Manager
 *
 * Three phases:
 *   11:30 PM — Nightly Analysis  : AI generates tomorrow's content plan
 *   11:35 PM — Execution         : Publish today's planned post
 *   11:00 PM — Analytics Sync    : Pull metrics for recent posts
 */

/**
 * Utility to get local YYYY-MM-DD string
 */
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ─── Nightly Analysis Phase ───────────────────────────────────────────────────

async function nightlyAnalysisPhase() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('→ NIGHTLY ANALYSIS PHASE STARTED');
    console.log('═══════════════════════════════════════════════════════════');

    try {
        const historicalPosts = await getHistoricalPosts(7);
        const recentTopics = await getRecentTopics(14);

        if (recentTopics.length > 0) {
            console.log(`→ Avoiding recent topics: ${recentTopics.slice(0, 5).join(', ')}${recentTopics.length > 5 ? '...' : ''}`);
        }

        const contentPlan = await generateContentPlan(historicalPosts, recentTopics);
        const planId = await insertContentPlan(contentPlan);

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`✓ NIGHTLY ANALYSIS PHASE COMPLETED - Plan ID: ${planId}`);
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
            console.log('⚠ No planned post for today — skipping');
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
        const recentPosts = await getRecentPublishedPosts(2);

        if (recentPosts.length === 0) {
            console.log('⚠ No recent posts to sync');
            console.log('═══════════════════════════════════════════════════════════\n');
            return;
        }

        console.log(`→ Found ${recentPosts.length} post(s) to sync`);
        let syncedCount = 0;

        for (const post of recentPosts) {
            try {
                const metrics = await getPostMetrics(post.id.toString(), post.platform);
                await updatePostMetrics(post.id, metrics.likes, metrics.reach);
                syncedCount++;
            } catch (err) {
                console.error(`✗ Failed to sync metrics for post ${post.id}:`, err.message);
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`✓ ANALYTICS SYNC PHASE COMPLETED - Synced ${syncedCount} post(s)`);
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════════════');
        console.error('✗ ANALYTICS SYNC PHASE FAILED');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('Error:', error.message);
        console.log('⚠ System will continue — retry on next cycle\n');
    }
}

// ─── runNow (immediate AI post for manual testing) ────────────────────────────

async function runNow() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('→ IMMEDIATE POST: Generating and publishing now...');
    console.log('═══════════════════════════════════════════════════════════');

    const db = getDatabase();
    const historicalPosts = await getHistoricalPosts(7);
    const recentTopics = await getRecentTopics(14);
    const contentPlan = await generateContentPlan(historicalPosts, recentTopics);

    const today = getLocalDateString();
    const platform = contentPlan.format === 'reel' ? 'instagram' : 'both';

    const planId = await new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO post_history (target_date, platform, format, topic, caption, media_prompt, ai_analysis, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [today, platform, contentPlan.format, contentPlan.topic, contentPlan.caption, contentPlan.media_prompt || null, contentPlan.ai_analysis, 'planned'],
            function (err) { if (err) reject(err); else resolve(this.lastID); }
        );
    });

    console.log(`✓ Plan saved with ID ${planId} for today (${today})`);
    await executionPhase();
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getRecentPublishedPosts(days) {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = getLocalDateString(cutoffDate);

    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM post_history WHERE status = 'published' AND target_date >= ? ORDER BY target_date DESC`,
            [cutoffDateStr],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });
}

module.exports = { nightlyAnalysisPhase, executionPhase, analyticsSyncPhase, runNow };
