"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    try {
        const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production';
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        const result = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [decoded.userId]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        req.user = {
            id: String(result.rows[0].id),
            email: result.rows[0].email,
            role: result.rows[0].role
        };
        return next();
    }
    catch (error) {
        console.error('Auth error:', error);
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};
exports.authenticateToken = authenticateToken;
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    return next();
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map