const fs = require('fs').promises;
const path = require('path');
const { FOLDER_NAMES } = require('../utils/constants');

class FileSystemService {
  // Get folder structure for a customer
  async getFolderStructure(basePath) {
    const folders = [];

    for (const [folderName, displayName] of Object.entries(FOLDER_NAMES)) {
      const folderPath = path.join(basePath, folderName);

      try {
        const stats = await fs.stat(folderPath);
        if (stats.isDirectory()) {
          const files = await fs.readdir(folderPath);

          // Get file details
          const fileDetails = await Promise.all(
            files.map(async (fileName) => {
              const filePath = path.join(folderPath, fileName);
              try {
                const fileStats = await fs.stat(filePath);
                return {
                  name: fileName,
                  path: path.join(folderName, fileName),
                  size: fileStats.size,
                  isDirectory: fileStats.isDirectory(),
                  modified: fileStats.mtime
                };
              } catch (err) {
                return {
                  name: fileName,
                  path: path.join(folderName, fileName),
                  error: 'Cannot access file'
                };
              }
            })
          );

          folders.push({
            name: displayName,
            path: folderName,
            fullPath: folderPath,
            fileCount: files.length,
            files: fileDetails
          });
        }
      } catch (error) {
        // Folder doesn't exist or can't be read
        folders.push({
          name: displayName,
          path: folderName,
          fullPath: folderPath,
          fileCount: 0,
          files: [],
          error: 'Folder not accessible'
        });
      }
    }

    return folders;
  }

  // Get file content
  async getFileContent(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Cannot read file: ${error.message}`);
    }
  }

  // List files in directory
  async listFiles(directoryPath) {
    try {
      const files = await fs.readdir(directoryPath, { withFileTypes: true });
      return files.map(file => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        path: path.join(directoryPath, file.name)
      }));
    } catch (error) {
      throw new Error(`Cannot list files: ${error.message}`);
    }
  }

  // Count photos in photo directory
  async countPhotos(basePath) {
    const photoDir = path.join(basePath, '02_PHOTOS');
    try {
      const files = await fs.readdir(photoDir);
      // Filter for image files
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
      });
      return imageFiles.length;
    } catch (error) {
      return 0;
    }
  }

  // Check if folder exists
  async folderExists(folderPath) {
    try {
      const stats = await fs.stat(folderPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  // Get folder size
  async getFolderSize(folderPath) {
    try {
      const files = await fs.readdir(folderPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          totalSize += await this.getFolderSize(filePath);
        } else {
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = new FileSystemService();
