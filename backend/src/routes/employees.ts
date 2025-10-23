import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all employees
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('department').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const department = req.query.department as string;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (department) {
      where.department = { contains: department, mode: 'insensitive' };
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { firstName: 'asc' }
      }),
      prisma.employee.count({ where })
    ]);

    res.json({
      employees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get employee by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id }
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create employee (Admin only)
router.post('/', authenticateToken, [
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('position').notEmpty().trim(),
  body('department').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('phone').notEmpty().trim(),
  body('telegram').optional().isString(),
  body('photo').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const {
      firstName,
      lastName,
      middleName,
      position,
      department,
      email,
      phone,
      telegram,
      photo
    } = req.body;

    // Check if employee with email already exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { email }
    });

    if (existingEmployee) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        middleName,
        position,
        department,
        email,
        phone,
        telegram,
        photo
      }
    });

    res.status(201).json({
      message: 'Employee created successfully',
      employee
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update employee (Admin only)
router.put('/:id', authenticateToken, [
  body('firstName').optional().notEmpty().trim(),
  body('lastName').optional().notEmpty().trim(),
  body('position').optional().notEmpty().trim(),
  body('department').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().notEmpty().trim(),
  body('telegram').optional().isString(),
  body('photo').optional().isString(),
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

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id }
    });

    if (!existingEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // If email is being updated, check for conflicts
    if (updateData.email && updateData.email !== existingEmployee.email) {
      const emailConflict = await prisma.employee.findUnique({
        where: { email: updateData.email }
      });

      if (emailConflict) {
        return res.status(400).json({ message: 'Employee with this email already exists' });
      }
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: 'Employee updated successfully',
      employee
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete employee (Admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id }
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await prisma.employee.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Employee deactivated successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
