/**
 * One-time utility to exchange a User Access Token for a Page Access Token.
 * 
 * 1. Put your User Access Token in .env as FB_PAGE_ACCESS_TOKEN temporarily
 * 2. Run: node get-page-token.js
 * 3. Copy the Page Access Token printed for your page into .env
 * 
 * For a long-lived token, also set FB_APP_ID and FB_APP_SECRET in .env
 */

require('dotenv').config();
const axios = require('axios');

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';
const userToken = process.env.FB_PAGE_ACCESS_TOKEN;
const appId = process.env.FB_APP_ID;
const appSecret = process.env.FB_APP_SECRET;

async function getPageToken() {
    if (!userToken) {
        console.error('✗ Set your User Access Token as FB_PAGE_ACCESS_TOKEN in .env first');
        process.exit(1);
    }

    try {
        // Step 1: Optionally exchange for a long-lived user token first
        let tokenToUse = userToken;

        if (appId && appSecret) {
            console.log('→ Exchanging for long-lived user token...');
            const llRes = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: appId,
                    client_secret: appSecret,
                    fb_exchange_token: userToken
                }
            });
            tokenToUse = llRes.data.access_token;
            console.log('✓ Long-lived user token obtained');
        } else {
            console.warn('⚠ FB_APP_ID / FB_APP_SECRET not set — skipping long-lived exchange');
            console.warn('  Page token will be short-lived (~1 hour)');
        }

        // Step 2: Get all pages managed by this user
        console.log('\n→ Fetching pages you manage...');
        const pagesRes = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
            params: { access_token: tokenToUse }
        });

        const pages = pagesRes.data.data;

        if (!pages || pages.length === 0) {
            console.error('✗ No pages found for this user token');
            console.error('  Make sure the token has pages_show_list permission');
            process.exit(1);
        }

        console.log(`\n✓ Found ${pages.length} page(s):\n`);

        for (const page of pages) {
            console.log(`  Page Name  : ${page.name}`);
            console.log(`  Page ID    : ${page.id}`);
            console.log(`  Page Token : ${page.access_token}`);
            console.log(`  Category   : ${page.category}`);

            if (page.id === process.env.FB_PAGE_ID) {
                console.log('\n  ★ This matches your FB_PAGE_ID');
                console.log('\n  Copy this into your .env:');
                console.log(`  FB_PAGE_ACCESS_TOKEN=${page.access_token}`);
            }
            console.log('');
        }

        if (pages.length > 1) {
            console.log('  → Multiple pages found. Copy the token for the page matching your FB_PAGE_ID.');
        }

    } catch (err) {
        console.error('✗ Failed:', err.response?.data?.error?.message || err.message);
        console.error('  Full error:', JSON.stringify(err.response?.data, null, 2));
    }
}

getPageToken();
