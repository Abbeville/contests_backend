import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow images and videos
  const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  }
});

// Upload single file
router.post('/single', authenticate, upload.single('file'), (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('Upload single file error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

// Upload multiple files
router.post('/multiple', authenticate, upload.array('files', 5), (req: any, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const files = req.files.map((file: Express.Multer.File) => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: `/uploads/${file.filename}`
    }));

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      data: { files }
    });
  } catch (error) {
    console.error('Upload multiple files error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

// Upload avatar
router.post('/avatar', authenticate, upload.single('avatar'), (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate that it's an image
    const allowedImageTypes = /jpeg|jpg|png|gif/;
    const extname = allowedImageTypes.test(path.extname(req.file.originalname).toLowerCase());
    const mimetype = allowedImageTypes.test(req.file.mimetype);

    if (!mimetype || !extname) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed for avatars'
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Avatar upload failed'
    });
  }
});

// Upload contest cover image
router.post('/contest-cover', authenticate, upload.single('cover'), (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate that it's an image
    const allowedImageTypes = /jpeg|jpg|png|gif/;
    const extname = allowedImageTypes.test(path.extname(req.file.originalname).toLowerCase());
    const mimetype = allowedImageTypes.test(req.file.mimetype);

    if (!mimetype || !extname) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed for contest covers'
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Contest cover uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('Upload contest cover error:', error);
    res.status(500).json({
      success: false,
      message: 'Contest cover upload failed'
    });
  }
});

// Upload contest submission
router.post('/contest-submission', authenticate, upload.single('submission'), (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Contest submission uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('Upload contest submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Contest submission upload failed'
    });
  }
});

// Delete file
router.delete('/:filename', authenticate, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'File deletion failed'
    });
  }
});

// Get file info
router.get('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const stats = fs.statSync(filePath);

    res.json({
      success: true,
      data: {
        filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        url: `/uploads/${filename}`
      }
    });
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file info'
    });
  }
});

export default router;