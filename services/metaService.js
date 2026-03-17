const axios = require('axios');

/**
 * Meta Service
 * Handles publishing to Facebook (text-only) and retrieving performance metrics.
 * Instagram is skipped — requires media which is currently disabled.
 */

const GRAPH_API_VERSION = 'v25.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Prevent Brotli 'unexpected end of file' errors with Meta API
axios.defaults.headers.common['Accept-Encoding'] = 'identity';

/**
 * Publish a text-only post to a Facebook page.
 * @param {string} caption - Post text
 * @returns {Promise<{id: string}>}
 */
async function publishToFacebook(caption) {
    console.log('→ Publishing to Facebook...');

    const pageId = process.env.FB_PAGE_ID;
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!accessToken || !pageId) {
        console.warn('⚠ FB_PAGE_ACCESS_TOKEN or FB_PAGE_ID not configured — simulating publish');
        const simulatedId = `simulated_fb_${Date.now()}`;
        console.log(`✓ Simulated Facebook publish - ID: ${simulatedId}`);
        return { id: simulatedId };
    }

    try {
        const response = await axios.post(`${GRAPH_API_BASE}/${pageId}/feed`, {
            access_token: accessToken,
            message: caption,
        });

        const postId = response.data.id;
        console.log(`✓ Published to Facebook - Post ID: ${postId}`);
        return { id: postId };

    } catch (error) {
        console.error('✗ Facebook publish failed:', error.response?.data?.error?.message || error.message);
        console.error(error.stack);
        throw error;
    }
}

/**
 * Instagram publishing is disabled — requires media.
 * Returns a skipped marker so callers don't crash.
 */
async function publishToInstagram(format, caption) {
    console.log(`→ Publishing ${format} to Instagram...`);

    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    const igBusinessId = process.env.IG_BUSINESS_ID;

    if (!accessToken || !igBusinessId) {
        console.warn('⚠ FB_PAGE_ACCESS_TOKEN or IG_BUSINESS_ID not configured — simulating publish');
        const simulatedId = `simulated_ig_${Date.now()}`;
        console.log(`✓ Simulated Instagram publish - ID: ${simulatedId}`);
        return { id: simulatedId };
    }

    console.warn('⚠ Instagram publishing is disabled (text-only mode — no media available)');
    return { id: 'skipped_instagram_no_media' };
}

/**
 * Retrieve performance metrics for a published post.
 * @param {string} postId
 * @param {string} platform - 'facebook' | 'instagram'
 * @returns {Promise<{likes: number, reach: number}>}
 */
async function getPostMetrics(postId, platform) {
    console.log(`→ Retrieving metrics for ${platform} post ${postId}...`);

    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!accessToken) {
        console.warn('⚠ FB_PAGE_ACCESS_TOKEN not configured — skipping metrics');
        return { likes: 0, reach: 0 };
    }

    try {
        const metricsToFetch = platform === 'facebook'
            ? 'post_impressions,post_engaged_users'
            : 'impressions,likes';

        const response = await axios.get(`${GRAPH_API_BASE}/${postId}/insights`, {
            params: { access_token: accessToken, metric: metricsToFetch },
        });

        const data = response.data.data || [];
        let likes = 0;
        let reach = 0;

        for (const metric of data) {
            if (metric.name === 'likes' || metric.name === 'post_engaged_users') {
                likes = metric.values?.[0]?.value || 0;
            }
            if (metric.name === 'impressions' || metric.name === 'post_impressions') {
                reach = metric.values?.[0]?.value || 0;
            }
        }

        console.log(`✓ Metrics — Likes: ${likes}, Reach: ${reach}`);
        return { likes, reach };

    } catch (error) {
        console.error(`✗ Metrics retrieval failed for post ${postId}:`, error.message);
        console.error(error.stack);
        return { likes: 0, reach: 0 };
    }
}

/**
 * Synchronize performance metrics for recent posts.
 */
async function syncRecentMetrics(getRecentPosts, updateMetrics) {
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!accessToken) {
        console.warn('⚠ FB_PAGE_ACCESS_TOKEN not configured — skipping metrics sync');
        return;
    }

    try {
        const posts = await getRecentPosts();
        for (const post of posts) {
            const metrics = await getPostMetrics(post.post_id, post.platform);
            await updateMetrics(post.id, metrics.likes, metrics.reach);
        }
    } catch (error) {
        console.error('✗ Metrics sync failed:', error.message);
        console.error(error.stack);
    }
}

module.exports = { 
    publishToFacebook, 
    publishToInstagram, 
    getPostMetrics,
    syncRecentMetrics
};
