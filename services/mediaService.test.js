const MediaService = require('./mediaService');
const fs = require('fs').promises;
const path = require('path');

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    access: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn()
  }
}));

describe('MediaService', () => {
  let mediaService;
  const mockUploadDir = './test-uploads';

  beforeEach(() => {
    mediaService = new MediaService(mockUploadDir);
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should create upload directory', async () => {
      fs.mkdir.mockResolvedValue();

      await mediaService.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(mockUploadDir, { recursive: true });
    });

    it('should handle directory creation errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(mediaService.initialize())
        .rejects.toThrow('Failed to create upload directory: Permission denied');
    });
  });

  describe('saveMedia', () => {
    it('should save media file', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      const buffer = Buffer.from('test data');

      const result = await mediaService.saveMedia(buffer, 'test.jpg');

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('url');
      expect(result.filename).toMatch(/\.jpg$/);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockRejectedValue(new Error('Disk full'));
      const buffer = Buffer.from('test data');

      await expect(mediaService.saveMedia(buffer, 'test.jpg'))
        .rejects.toThrow('Failed to save media: Disk full');
    });
  });

  describe('getMedia', () => {
    it('should retrieve media file', async () => {
      const mockBuffer = Buffer.from('test data');
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(mockBuffer);

      const result = await mediaService.getMedia('test.jpg');

      expect(result).toEqual(mockBuffer);
      expect(fs.access).toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should throw error if file not found', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(mediaService.getMedia('missing.jpg'))
        .rejects.toThrow('Failed to get media: File not found');
    });
  });

  describe('deleteMedia', () => {
    it('should delete media file', async () => {
      fs.access.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      const result = await mediaService.deleteMedia('test.jpg');

      expect(result).toBe(true);
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should return false if file not found', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await mediaService.deleteMedia('missing.jpg');

      expect(result).toBe(false);
    });

    it('should handle deletion errors', async () => {
      fs.access.mockResolvedValue();
      fs.unlink.mockRejectedValue(new Error('Permission denied'));

      await expect(mediaService.deleteMedia('test.jpg'))
        .rejects.toThrow('Failed to delete media: Permission denied');
    });
  });

  describe('listMedia', () => {
    it('should list all media files', async () => {
      fs.mkdir.mockResolvedValue();
      fs.readdir.mockResolvedValue(['file1.jpg', 'file2.png']);
      fs.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date('2024-01-01')
      });

      const result = await mediaService.listMedia();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('filename');
      expect(result[0]).toHaveProperty('path');
      expect(result[0]).toHaveProperty('url');
      expect(result[0]).toHaveProperty('size');
      expect(result[0]).toHaveProperty('created');
    });

    it('should return empty array if no files', async () => {
      fs.mkdir.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);

      const result = await mediaService.listMedia();

      expect(result).toEqual([]);
    });

    it('should handle listing errors', async () => {
      fs.mkdir.mockResolvedValue();
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      await expect(mediaService.listMedia())
        .rejects.toThrow('Failed to list media: Permission denied');
    });
  });
});
