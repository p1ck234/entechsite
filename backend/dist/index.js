"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const pg_1 = require("pg");
const auth_1 = __importDefault(require("./routes/auth"));
const employees_1 = __importDefault(require("./routes/employees"));
const courses_1 = __importDefault(require("./routes/courses"));
const lessons_1 = __importDefault(require("./routes/lessons"));
const users_1 = __importDefault(require("./routes/users"));
const events_1 = __importDefault(require("./routes/events"));
const calendar_1 = __importDefault(require("./routes/calendar"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://p1ck23@localhost:5432/entechsite',
});
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? [
            'https://entech.p1ck23.ru',
            'http://entech.p1ck23.ru',
            'https://web.telegram.org',
            'https://webk.telegram.org',
            'https://webz.telegram.org'
        ]
        : [
            'http://localhost:5173',
            'http://localhost:3000',
            'https://entech.p1ck23.ru',
            'https://web.telegram.org',
            'https://webk.telegram.org',
            'https://webz.telegram.org'
        ],
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/auth', auth_1.default);
app.use('/api/employees', employees_1.default);
app.use('/api/courses', courses_1.default);
app.use('/api/lessons', lessons_1.default);
app.use('/api/users', users_1.default);
app.use('/api/events', events_1.default);
app.use('/api/calendar', calendar_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await pool.end();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await pool.end();
    process.exit(0);
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
//# sourceMappingURL=index.js.map