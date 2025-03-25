import fs from 'fs';

export const ensureUploadDirectory = () => {
  if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
  }
};