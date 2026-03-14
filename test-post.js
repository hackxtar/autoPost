/**
 * Manual test script for Meta API publishing.
 * Bypasses AI and database — uses hardcoded content.
 * 
 * Usage:
 *   node test-post.js facebook
 *   node test-post.js instagram
 *   node test-post.js both
 */

require('dotenv').config();
const axios = require('axios');

const GRAPH_API_VERSION = 'v25.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Hardcoded test content — no AI tokens burned
const TEST_CAPTION = 'Test post from AI Social Media Manager 🚀';
const TEST_IMAGE_URL = 'https://image.pollinations.ai/prompt/a%20beautiful%20sunset%20over%20the%20ocean';

// ─── Debug helpers ────────────────────────────────────────────────────────────

function debugEnv() {
    console.log('\n[DEBUG] Environment variables:');
    console.log('  FB_PAGE_ACCESS_TOKEN :', process.env.FB_PAGE_ACCESS_TOKEN
        ? `set (${process.env.FB_PAGE_ACCESS_TOKEN.length} chars, starts with "${process.env.FB_PAGE_ACCESS_TOKEN.slice(0, 8)}...")`
        : 'NOT SET ❌');
    console.log('  FB_PAGE_ID           :', process.env.FB_PAGE_ID || 'NOT SET ❌');
    console.log('  IG_BUSINESS_ID       :', process.env.IG_BUSINESS_ID || 'NOT SET ❌');
}

async function debugTokenInfo() {
    console.log('\n[DEBUG] Verifying token via /me endpoint...');
    try {
        const res = await axios.get(`${GRAPH_API_BASE}/me`, {
            params: { access_token: process.env.FB_PAGE_ACCESS_TOKEN, fields: 'id,name' }
        });
        console.log('  Token identity:', JSON.stringify(res.data));

        // Check if it's a Page token (ID should match FB_PAGE_ID)
        const isPageToken = res.data.id === process.env.FB_PAGE_ID;
        if (!isPageToken) {
            console.warn(`  ⚠ Token identity ID (${res.data.id}) does not match FB_PAGE_ID (${process.env.FB_PAGE_ID})`);
            console.warn('  → You are likely using a User token. For Page publishing, a Page Access Token is required.');
        } else {
            console.log('  ✓ Token ID matches FB_PAGE_ID (Page Token detected)');
        }
        return isPageToken;
    } catch (err) {
        console.error('  ✗ Token verification failed:', err.response?.data || err.message);
        return false;
    }
}

async function debugTokenPermissions() {
    console.log('\n[DEBUG] Checking token permissions...');
    try {
        const res = await axios.get(`${GRAPH_API_BASE}/me/permissions`, {
            params: { access_token: process.env.FB_PAGE_ACCESS_TOKEN }
        });
        const perms = res.data.data || [];
        const granted = perms.filter(p => p.status === 'granted').map(p => p.permission);
        const declined = perms.filter(p => p.status === 'declined').map(p => p.permission);
        console.log('  Granted :', granted.join(', ') || 'none');
        if (declined.length) console.warn('  Declined:', declined.join(', '));

        const required = ['pages_manage_posts', 'pages_read_engagement'];
        for (const perm of required) {
            if (granted.includes(perm)) {
                console.log(`  ✓ ${perm}`);
            } else {
                console.warn(`  ✗ MISSING: ${perm}`);
            }
        }
    } catch (err) {
        console.error('  ✗ Permission check failed:', err.response?.data || err.message);
    }
}

// ─── Facebook test ────────────────────────────────────────────────────────────

async function testFacebook() {
    console.log('\n══════════════════════════════════════');
    console.log('  TEST: Facebook Publish');
    console.log('══════════════════════════════════════');

    const pageId = process.env.FB_PAGE_ID;
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!pageId || !accessToken) {
        console.error('✗ FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN missing in .env');
        return;
    }

    const endpoint = `${GRAPH_API_BASE}/${pageId}/feed`;
    const payload = {
        access_token: accessToken,
        message: TEST_CAPTION,
        link: TEST_IMAGE_URL
    };

    console.log('\n[DEBUG] Request details:');
    console.log('  Endpoint :', endpoint);
    console.log('  Caption  :', payload.message);
    console.log('  Link URL :', payload.link);

    try {
        console.log('\n→ Sending request...');
        const res = await axios.post(endpoint, payload);
        console.log('✓ Facebook publish SUCCESS');
        console.log('  Response:', JSON.stringify(res.data));
    } catch (err) {
        console.error('✗ Facebook publish FAILED');
        console.error('  HTTP status :', err.response?.status);
        console.error('  Error code  :', err.response?.data?.error?.code);
        console.error('  Error type  :', err.response?.data?.error?.type);
        console.error('  Message     :', err.response?.data?.error?.message);
        console.error('  FB trace ID :', err.response?.data?.error?.fbtrace_id);
        console.log('\n[DEBUG] Full error response:');
        console.log(JSON.stringify(err.response?.data, null, 2));
    }
}

// ─── Instagram test ───────────────────────────────────────────────────────────

async function testInstagram() {
    console.log('\n══════════════════════════════════════');
    console.log('  TEST: Instagram Publish');
    console.log('══════════════════════════════════════');

    const igId = process.env.IG_BUSINESS_ID;
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!igId || !accessToken) {
        console.error('✗ IG_BUSINESS_ID or FB_PAGE_ACCESS_TOKEN missing in .env');
        return;
    }

    const containerEndpoint = `${GRAPH_API_BASE}/${igId}/media`;
    const payload = {
        access_token: accessToken,
        caption: TEST_CAPTION,
        image_url: TEST_IMAGE_URL
    };

    console.log('\n[DEBUG] Request details:');
    console.log('  Container endpoint:', containerEndpoint);
    console.log('  Caption           :', payload.caption);
    console.log('  Image URL         :', payload.image_url);

    try {
        console.log('\n→ Step 1: Creating media container...');
        const containerRes = await axios.post(containerEndpoint, payload);
        const creationId = containerRes.data.id;
        console.log(`✓ Container created - ID: ${creationId}`);

        const publishEndpoint = `${GRAPH_API_BASE}/${igId}/media_publish`;
        console.log('\n→ Step 2: Publishing container...');
        console.log('  Publish endpoint:', publishEndpoint);

        const publishRes = await axios.post(publishEndpoint, {
            access_token: accessToken,
            creation_id: creationId
        });
        console.log('✓ Instagram publish SUCCESS');
        console.log('  Response:', JSON.stringify(publishRes.data));
    } catch (err) {
        console.error('✗ Instagram publish FAILED');
        console.error('  HTTP status :', err.response?.status);
        console.error('  Error code  :', err.response?.data?.error?.code);
        console.error('  Error type  :', err.response?.data?.error?.type);
        console.error('  Message     :', err.response?.data?.error?.message);
        console.error('  FB trace ID :', err.response?.data?.error?.fbtrace_id);
        console.log('\n[DEBUG] Full error response:');
        console.log(JSON.stringify(err.response?.data, null, 2));
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const target = process.argv[2] || 'both';

    debugEnv();
    const isPageToken = await debugTokenInfo();
    
    if (!isPageToken) {
        await debugTokenPermissions();
    } else {
        console.log('\n[DEBUG] Skipping permission check (already using a Page Token)');
    }

    if (target === 'facebook' || target === 'both') await testFacebook();
    if (target === 'instagram' || target === 'both') await testInstagram();

    console.log('\n✓ Test script complete\n');
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
