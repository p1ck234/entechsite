import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all courses
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          progress: {
            where: { userId: req.user?.id },
            select: { progress: true, completed: true }
          }
        }
      }),
      prisma.course.count({ where })
    ]);

    // Add user progress to each course
    const coursesWithProgress = courses.map(course => ({
      ...course,
      userProgress: course.progress[0] || { progress: 0, completed: false }
    }));

    res.json({
      courses: coursesWithProgress,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get course by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        progress: {
          where: { userId: req.user?.id },
          select: { progress: true, completed: true, startedAt: true, completedAt: true }
        }
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const courseWithProgress = {
      ...course,
      userProgress: course.progress[0] || { progress: 0, completed: false, startedAt: null, completedAt: null }
    };

    res.json(courseWithProgress);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create course (Admin only)
router.post('/', authenticateToken, [
  body('title').notEmpty().trim(),
  body('description').optional().isString(),
  body('googleDriveUrl').isURL(),
  body('duration').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { title, description, googleDriveUrl, duration } = req.body;

    const course = await prisma.course.create({
      data: {
        title,
        description,
        googleDriveUrl,
        duration
      }
    });

    res.status(201).json({
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update course (Admin only)
router.put('/:id', authenticateToken, [
  body('title').optional().notEmpty().trim(),
  body('description').optional().isString(),
  body('googleDriveUrl').optional().isURL(),
  body('duration').optional().isInt({ min: 1 }),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const updateData = req.body;

    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: 'Course updated successfully',
      course: updatedCourse
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete course (Admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    await prisma.course.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Course deactivated successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update course progress
router.post('/:id/progress', authenticateToken, [
  body('progress').isInt({ min: 0, max: 100 }),
  body('completed').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { progress, completed = false } = req.body;
    const userId = req.user!.id;

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Upsert progress
    const courseProgress = await prisma.courseProgress.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId: id
        }
      },
      update: {
        progress,
        completed,
        completedAt: completed ? new Date() : null
      },
      create: {
        userId,
        courseId: id,
        progress,
        completed,
        completedAt: completed ? new Date() : null
      }
    });

    res.json({
      message: 'Progress updated successfully',
      progress: courseProgress
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's course progress
router.get('/progress/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const userProgress = await prisma.courseProgress.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            duration: true,
            googleDriveUrl: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ progress: userProgress });
  } catch (error) {
    console.error('Get user progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
