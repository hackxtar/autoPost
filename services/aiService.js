const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AI Service for content planning using Google Gemini API
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 11.2, 12.1, 12.2
 */

// Initialize Gemini API client
let genAI = null;
let model = null;

/**
 * Initialize the Gemini API client
 */
function initializeGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });
    
    console.log(`✓ Gemini API initialized (Model: ${modelName})`);
}

/**
 * Validate content plan structure and format
 * Requirements: 3.3, 3.4
 * 
 * @param {Object} plan - Content plan to validate
 * @returns {Object} Validated content plan
 * @throws {Error} If plan is invalid
 */
function validateContentPlan(plan) {
    // Check for required fields
    const requiredFields = ['format', 'topic', 'caption', 'media_prompt', 'ai_analysis'];
    const missingFields = requiredFields.filter(field => !plan[field] || (typeof plan[field] === 'string' && plan[field].trim() === ''));
    
    if (missingFields.length > 0) {
        throw new Error(`Content plan missing required fields: ${missingFields.join(', ')}`);
    }
    
    // Validate format enumeration
    const validFormats = ['post', 'reel', 'story'];
    if (!validFormats.includes(plan.format)) {
        throw new Error(`Invalid format '${plan.format}'. Must be one of: ${validFormats.join(', ')}`);
    }
    
    return plan;
}

/**
 * Generate content plan based on historical performance data
 * Requirements: 3.1, 3.2, 3.5, 3.6, 12.1, 12.2
 * 
 * @param {Array} historicalPosts - Array of historical post records with metrics
 * @param {Array} recentTopics - Array of recent topic strings to avoid duplicating
 * @param {number} retryCount - Current retry attempt (internal use)
 * @returns {Promise<Object>} Generated and validated content plan
 */
async function generateContentPlan(historicalPosts, recentTopics = [], retryCount = 0) {
    try {
        // Initialize Gemini if not already done
        if (!model) {
            initializeGemini();
        }
        
        console.log('→ Generating content plan with AI...');
        
        // Format historical data for AI prompt
        const historicalSummary = historicalPosts.length > 0
            ? historicalPosts.map(post => 
                `- ${post.format} on ${post.platform}: "${post.topic}" (Likes: ${post.likes}, Reach: ${post.reach})`
              ).join('\n')
            : 'No historical data available yet.';

        // Format recent topics to avoid duplication
        const recentTopicsList = recentTopics.length > 0
            ? recentTopics.map(t => `- ${t}`).join('\n')
            : 'None yet.';
        
        // Construct AI prompt with business context, few-shot examples, and duplicate prevention
        const prompt = `You are an elite, conversion-focused Social Media Copywriter working for "Sites by Sayyad" (https://sitesbysayyad.com/), a web design and IT company. Your goal is to write highly engaging, stop-scrolling content for Facebook and Instagram.

BUSINESS CONTEXT:
- Service: Custom website design & development, IT solutions
- Target audience: Small business owners, entrepreneurs, startups looking for a web presence
- Brand tone: Professional, modern, energetic, value-driven

RECENT TOPICS ALREADY POSTED (pick a clearly DIFFERENT angle — do NOT repeat these):
${recentTopicsList}

HISTORICAL PERFORMANCE (Last 7 Days):
${historicalSummary}

TASK: Write a post based on a fresh topic relevant to web design, web development, SEO, UI/UX, or digital business growth.

═══════════════════════════════════════════
STRICT FORMATTING RULES — FOLLOW EXACTLY:
═══════════════════════════════════════════
1. NO WALLS OF TEXT. Max 2 sentences per paragraph. Single-line gaps between sections.
2. Strong Hook: The VERY FIRST LINE must grab attention (bold question, shocking stat, or pain point). Nothing before it.
3. Choose ONE body format below — rotate to keep the feed fresh:

   FORMAT A — Emoji Bullet List:
   Hook line

   🔴 Point one
   🟡 Point two
   🟢 Point three
   🔵 Point four

   Closing 1-2 sentence CTA.

   FORMAT B — Comparison Table (plain text):
   Hook line

   ❌ Without us → [bad outcome]
   ✅ With us    → [good outcome]

   (repeat 3-4 rows)

   Closing 1-2 sentence CTA.

   FORMAT C — Rapid-fire single lines:
   Hook line

   Line one.

   Line two.

   Line three.

   Line four.

   Closing 1-2 sentence CTA.

4. Add 5-8 relevant hashtags on their own line after the CTA.
5. MANDATORY FOOTER — copy this EXACTLY, on its own line after hashtags:

👇 Let's build something amazing:
🌐 Web: https://sitesbysayyad.com/
📞 Call: +91 91720 08681
💬 WhatsApp: +91 86051 37805

═══════════════════════════════════════════
FEW-SHOT EXAMPLES (study these, do not copy):
═══════════════════════════════════════════

EXAMPLE 1 — Format A:
---
Is your website driving customers away? 🤔

🐢 Loads in 5+ seconds
📵 Breaks on mobile
🎨 Looks like it's from 2010
🔇 No clear call-to-action

Every second of delay costs you real money. Let's fix that today.

#WebDesign #WebDevelopment #SmallBusiness #DigitalMarketing #SitesBySayyad

👇 Let's build something amazing:
🌐 Web: https://sitesbysayyad.com/
📞 Call: +91 91720 08681
💬 WhatsApp: +91 86051 37805
---

EXAMPLE 2 — Format B:
---
Most small businesses are invisible online. Are you one of them?

❌ No website → customers can't find you
✅ Professional site → 24/7 lead generation

❌ DIY builder → generic, forgettable look
✅ Custom design → brand that stands out

❌ No SEO → buried on page 10
✅ Optimised site → top of Google search

Your website is your hardest-working employee. Make it count.

#SEO #WebDesign #SmallBusiness #LocalBusiness #SitesBySayyad

👇 Let's build something amazing:
🌐 Web: https://sitesbysayyad.com/
📞 Call: +91 91720 08681
💬 WhatsApp: +91 86051 37805
---

EXAMPLE 3 — Format C:
---
Your competitor just launched a new website. Did you notice?

Speed matters more than design.

Mobile users make up 60% of all traffic.

First impressions happen in 0.05 seconds.

A slow, ugly site is a closed door.

We build doors that open — and convert.

#WebDevelopment #UXDesign #MobileFirst #DigitalGrowth #SitesBySayyad

👇 Let's build something amazing:
🌐 Web: https://sitesbysayyad.com/
📞 Call: +91 91720 08681
💬 WhatsApp: +91 86051 37805
---

Now write a NEW post. Do NOT copy the examples. Pick a fresh topic. Rotate the format.

Respond with ONLY a valid JSON object (no markdown, no code blocks, just raw JSON):
{
  "format": "post",
  "topic": "brief topic description (5 words max)",
  "caption": "the full post text including hook, body, hashtags, and the mandatory footer",
  "media_prompt": "a short tech/web-themed image description (max 150 chars, no hashtags)",
  "ai_analysis": "which format (A/B/C) you chose and why, and how it avoids recent topics"
}`;

        // Call Gemini API
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text();
        
        // Clean up response text (remove markdown code blocks if present)
        responseText = responseText.trim();
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/```\n?/g, '');
        }
        responseText = responseText.trim();
        
        // Parse JSON response
        let plan;
        try {
            plan = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(`Invalid JSON response from AI: ${parseError.message}`);
        }
        
        // Safety net: ensure mandatory footer is always present
        const MANDATORY_FOOTER = `👇 Let's build something amazing:\n🌐 Web: https://sitesbysayyad.com/\n📞 Call: +91 91720 08681\n💬 WhatsApp: +91 86051 37805`;
        if (plan.caption && !plan.caption.includes('sitesbysayyad.com')) {
            console.warn('⚠ AI omitted footer — appending it automatically');
            plan.caption = plan.caption.trimEnd() + '\n\n' + MANDATORY_FOOTER;
        }

        // Validate the content plan
        const validatedPlan = validateContentPlan(plan);
        
        // Log AI reasoning
        console.log('✓ AI Content Plan Generated');
        console.log(`  Format: ${validatedPlan.format}`);
        console.log(`  Topic: ${validatedPlan.topic}`);
        console.log(`  AI Analysis: ${validatedPlan.ai_analysis}`);
        
        return validatedPlan;
        
    } catch (error) {
        console.error('✗ AI service error:', error.message);
        console.error(error.stack);
        
        // Retry logic for invalid JSON responses (1 retry)
        if (retryCount < 1) {
            console.log('↻ Retrying AI content generation...');
            return generateContentPlan(historicalPosts, recentTopics, retryCount + 1);
        }
        
        // Retry exhausted, throw error
        throw error;
    }
}

module.exports = {
    initializeGemini,
    generateContentPlan,
    validateContentPlan
};
