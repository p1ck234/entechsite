"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
const pg_1 = require("pg");
const router = express_1.default.Router();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});
router.post('/register', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 6 }),
    (0, express_validator_1.body)('telegramUsername').notEmpty().trim(),
    (0, express_validator_1.body)('firstName').notEmpty().trim(),
    (0, express_validator_1.body)('lastName').notEmpty().trim(),
    (0, express_validator_1.body)('position').optional().isString().trim(),
    (0, express_validator_1.body)('department').optional().isString().trim(),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, password, telegramUsername, firstName, lastName, position, department } = req.body;
        const existingUsers = await pool.query('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(existingUsers.rows[0].count);
        if (userCount > 0) {
            return res.status(403).json({
                message: 'Регистрация закрыта. Обратитесь к администратору для добавления в систему.',
                hint: 'Первый пользователь уже зарегистрирован. Для добавления новых пользователей используйте админ-панель.'
            });
        }
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }
        const telegramNormalized = telegramUsername.startsWith('@')
            ? telegramUsername.substring(1)
            : telegramUsername;
        const existingEmployee = await pool.query('SELECT id FROM employees WHERE telegram = $1 OR telegram = $2', [telegramNormalized, `@${telegramNormalized}`]);
        if (existingEmployee.rows.length > 0) {
            return res.status(400).json({ message: 'Сотрудник с таким Telegram username уже существует' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const userResult = await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at', [email, hashedPassword, 'ADMIN']);
        const user = userResult.rows[0];
        const employeeResult = await pool.query(`INSERT INTO employees (first_name, last_name, position, department, email, phone, telegram, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [
            firstName,
            lastName,
            position || 'Сотрудник',
            department || 'Общий отдел',
            email,
            '+7 (000) 000-00-00',
            telegramNormalized,
            true
        ]);
        console.log('✅ Первый пользователь зарегистрирован:', {
            email: user.email,
            role: user.role,
            telegram: telegramNormalized,
            employeeId: employeeResult.rows[0].id
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production', { expiresIn: '30d' });
        res.status(201).json({
            message: 'Регистрация успешна! Вы стали первым администратором.',
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            },
            employee: {
                id: employeeResult.rows[0].id,
                firstName: employeeResult.rows[0].first_name,
                lastName: employeeResult.rows[0].last_name,
                telegram: employeeResult.rows[0].telegram
            },
            token,
            instructions: {
                telegram: `Ваш Telegram username: ${telegramNormalized}`,
                login: 'Теперь вы можете войти через Telegram Mini App',
                note: 'После входа через Telegram вы сможете добавлять других пользователей через админ-панель'
            }
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Ошибка при регистрации', error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = result.rows[0];
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production', { expiresIn: '7d' });
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            },
            token
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/telegram', [
    (0, express_validator_1.body)('initData').notEmpty()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { initData } = req.body;
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        params.delete('hash');
        const userStr = params.get('user');
        if (!userStr) {
            return res.status(400).json({ message: 'User data not found in initData' });
        }
        const telegramUser = JSON.parse(decodeURIComponent(userStr));
        const telegramId = telegramUser.id;
        const telegramUsername = telegramUser.username;
        console.log('🔍 Telegram авторизация:', {
            telegramId,
            telegramUsername,
            fullUser: telegramUser
        });
        if (!telegramId) {
            return res.status(400).json({ message: 'Telegram user ID not found' });
        }
        const searchVariants = [];
        if (telegramUsername) {
            const usernameNormalized = telegramUsername.startsWith('@')
                ? telegramUsername.substring(1)
                : telegramUsername;
            searchVariants.push(usernameNormalized);
            searchVariants.push(`@${usernameNormalized}`);
            if (telegramUsername !== usernameNormalized && telegramUsername !== `@${usernameNormalized}`) {
                searchVariants.push(telegramUsername);
            }
        }
        searchVariants.push(`${telegramId}`);
        console.log('🔍 Telegram данные:', {
            originalUsername: telegramUsername,
            normalized: telegramUsername ? (telegramUsername.startsWith('@') ? telegramUsername.substring(1) : telegramUsername) : null,
            telegramId
        });
        console.log('🔍 Варианты поиска:', searchVariants);
        const placeholders = searchVariants.map((_, i) => `telegram = $${i + 1}`).join(' OR ');
        const sqlQuery = `SELECT * FROM employees WHERE (${placeholders}) AND is_active = true`;
        console.log('🔍 SQL запрос:', sqlQuery);
        console.log('🔍 Параметры поиска:', searchVariants);
        const employeeResult = await pool.query(sqlQuery, searchVariants);
        console.log('🔍 Найдено сотрудников:', employeeResult.rows.length);
        let employee;
        let userEmail;
        if (employeeResult.rows.length === 0) {
            const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
            const totalUsers = parseInt(usersCount.rows[0].count);
            if (totalUsers === 0) {
                console.log('👤 Первый пользователь - создаем автоматически через Telegram');
                if (!telegramUsername) {
                    return res.status(400).json({
                        message: 'Для первого входа необходим Telegram username. Убедитесь, что у вас установлен username в настройках Telegram.'
                    });
                }
                const telegramNormalized = telegramUsername.startsWith('@')
                    ? telegramUsername.substring(1)
                    : telegramUsername;
                userEmail = `${telegramNormalized}@telegram.local`;
                const randomPassword = Math.random().toString(36).slice(-12);
                const hashedPassword = await bcryptjs_1.default.hash(randomPassword, 12);
                const userResult = await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING *', [userEmail, hashedPassword, 'ADMIN']);
                console.log('✅ Создан первый администратор:', userResult.rows[0].email);
                const employeeResult = await pool.query(`INSERT INTO employees (first_name, last_name, position, department, email, phone, telegram, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [
                    telegramUser.first_name || 'Пользователь',
                    telegramUser.last_name || 'Telegram',
                    'Администратор',
                    'IT-Отдел',
                    userEmail,
                    '+7 (000) 000-00-00',
                    telegramNormalized,
                    true
                ]);
                employee = employeeResult.rows[0];
                console.log('✅ Создан первый сотрудник с Telegram:', telegramNormalized);
            }
            else {
                const allEmployees = await pool.query('SELECT id, email, telegram, is_active FROM employees LIMIT 10');
                console.log('📋 Все сотрудники в базе:', allEmployees.rows.map(e => ({
                    id: e.id,
                    email: e.email,
                    telegram: e.telegram,
                    is_active: e.is_active
                })));
                return res.status(403).json({
                    message: 'Доступ запрещен. Обратитесь к администратору для добавления в систему.',
                    telegramUsername: telegramUsername || null,
                    telegramId: telegramId,
                    hint: `Ваш Telegram username: ${telegramUsername || 'не установлен'}. Сообщите его администратору.`
                });
            }
        }
        else {
            employee = employeeResult.rows[0];
            userEmail = employee.email;
            console.log('✅ Найден сотрудник:', {
                id: employee.id,
                email: employee.email,
                telegram: employee.telegram
            });
        }
        let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userEmail]);
        let user;
        if (userResult.rows.length === 0) {
            const randomPassword = Math.random().toString(36).slice(-12);
            const hashedPassword = await bcryptjs_1.default.hash(randomPassword, 10);
            const insertResult = await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING *', [userEmail, hashedPassword, 'USER']);
            user = insertResult.rows[0];
        }
        else {
            user = userResult.rows[0];
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role, telegramId }, process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production', { expiresIn: '30d' });
        res.json({
            message: 'Telegram login successful',
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                telegramId: telegramId,
                telegramUser: telegramUser
            },
            token
        });
    }
    catch (error) {
        console.error('Telegram login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Access token required' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-this-in-production');
        const result = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [decoded.userId]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        const user = result.rows[0];
        return res.json({ user });
    }
    catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map