/**
 * Media Service — disabled (text-only mode)
 * Stub kept so existing imports don't break.
 */

async function generateMedia(format, prompt) {
    console.warn('⚠ Image generation is disabled — text-only mode');
    return null;
}

module.exports = { generateMedia };
