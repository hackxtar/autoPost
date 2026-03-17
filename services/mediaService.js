const fs = require('fs').promises;
const path = require('path');

/**
 * Media Service — disabled (text-only mode)
 * Stub kept so existing imports don't break and tests pass.
 */
class MediaService {
    constructor(uploadDir) {
        this.uploadDir = uploadDir || 'uploads';
    }

    async initialize() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create upload directory: ${error.message}`);
        }
    }

    async saveMedia(buffer, filename) {
        try {
            await this.initialize();
            const filePath = path.join(this.uploadDir, filename);
            await fs.writeFile(filePath, buffer);
            return {
                filename,
                path: filePath,
                url: `file://${filePath}`
            };
        } catch (error) {
            throw new Error(`Failed to save media: ${error.message}`);
        }
    }

    async getMedia(filename) {
        try {
            const filePath = path.join(this.uploadDir, filename);
            await fs.access(filePath);
            return await fs.readFile(filePath);
        } catch (error) {
            if (error.message.includes('ENOENT')) {
                throw new Error('Failed to get media: File not found');
            }
            throw new Error(`Failed to get media: ${error.message}`);
        }
    }

    async deleteMedia(filename) {
        try {
            const filePath = path.join(this.uploadDir, filename);
            await fs.access(filePath);
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            if (error.message.includes('ENOENT')) {
                return false;
            }
            throw new Error(`Failed to delete media: ${error.message}`);
        }
    }

    async listMedia() {
        try {
            await this.initialize();
            const files = await fs.readdir(this.uploadDir);
            const mediaFiles = [];
            for (const file of files) {
                const filePath = path.join(this.uploadDir, file);
                const stats = await fs.stat(filePath);
                mediaFiles.push({
                    filename: file,
                    path: filePath,
                    url: `file://${filePath}`,
                    size: stats.size,
                    created: stats.birthtime
                });
            }
            return mediaFiles;
        } catch (error) {
            throw new Error(`Failed to list media: ${error.message}`);
        }
    }

    async generateMedia(format, prompt) {
        console.warn('⚠ Image generation is disabled — text-only mode');
        return null;
    }
}

module.exports = MediaService;
