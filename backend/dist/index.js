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
const db_init_1 = require("./utils/db-init");
dotenv_1.default.config();
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') {
    const pgHost = process.env.PGHOST;
    const pgPort = process.env.PGPORT || '5432';
    const pgUser = process.env.PGUSER;
    const pgPassword = process.env.PGPASSWORD;
    const pgDatabase = process.env.PGDATABASE;
    if (pgHost && pgUser && pgPassword && pgDatabase) {
        databaseUrl = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
        console.log('✅ DATABASE_URL собран из переменных PostgreSQL');
    }
    else {
        databaseUrl = process.env.POSTGRES_URL ||
            process.env.POSTGRES_DATABASE_URL ||
            process.env.DATABASE_CONNECTION_STRING;
    }
    if ((!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') && !pgHost) {
        const possibleServiceNames = ['Postgres', 'PostgreSQL', 'Database', 'Postgresql', 'DB', 'pg'];
        const allEnvKeys = Object.keys(process.env);
        for (const serviceName of possibleServiceNames) {
            const possibleKeys = [
                `${serviceName}_DATABASE_URL`,
                `${serviceName.toUpperCase()}_DATABASE_URL`,
                `${serviceName.toLowerCase()}_DATABASE_URL`,
            ];
            for (const key of possibleKeys) {
                if (process.env[key] && !process.env[key].includes('{{')) {
                    databaseUrl = process.env[key];
                    console.log(`✅ DATABASE_URL найден в переменной: ${key}`);
                    break;
                }
            }
            if (databaseUrl && !databaseUrl.includes('{{'))
                break;
        }
    }
    if (!databaseUrl || databaseUrl.includes('{{') || databaseUrl.trim() === '') {
        console.error('❌ DATABASE_URL не настроен!');
        console.error('\n📊 Доступные переменные PostgreSQL:');
        const pgVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
        pgVars.forEach(key => {
            const value = process.env[key];
            console.error(`   ${key}: ${value ? '✓ установлена' : '✗ не установлена'}`);
        });
        console.error('\n📋 Все переменные, содержащие "DATABASE" или "POSTGRES":');
        const dbRelatedVars = Object.keys(process.env).filter(key => key.toUpperCase().includes('DATABASE') ||
            key.toUpperCase().includes('POSTGRES') ||
            key.toUpperCase().includes('PG'));
        if (dbRelatedVars.length > 0) {
            dbRelatedVars.forEach(key => {
                const value = process.env[key];
                const masked = value && value.length > 30
                    ? `${value.substring(0, 15)}...${value.substring(value.length - 10)}`
                    : (value || '<empty>');
                console.error(`   ${key}: ${masked}`);
            });
        }
        else {
            console.error('   (переменные не найдены)');
        }
        console.error('\n📝 Решение для Railway:');
        console.error('   1. Убедитесь, что PostgreSQL сервис добавлен в проект');
        console.error('   2. В backend сервисе → Variables → DATABASE_URL');
        console.error('   3. Попробуйте эти варианты (по очереди):');
        console.error('      - ${{Postgres.DATABASE_URL}}');
        console.error('      - ${{PostgreSQL.DATABASE_URL}}');
        console.error('      - ${{Database.DATABASE_URL}}');
        console.error('      - ${{Postgresql.DATABASE_URL}}');
        console.error('   4. Или используйте "Raw Editor" чтобы увидеть все доступные переменные');
        process.exit(1);
    }
}
const app = (0, express_1.default)();
const pool = new pg_1.Pool({
    connectionString: databaseUrl,
});
const PORT = parseInt(process.env.PORT || '3001', 10);
app.use((0, helmet_1.default)());
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        'https://entech.p1ck23.ru',
        'http://entech.p1ck23.ru',
        'https://entechsite-production.up.railway.app',
        process.env.FRONTEND_URL,
        'https://web.telegram.org',
        'https://webk.telegram.org',
        'https://webz.telegram.org'
    ].filter((origin) => Boolean(origin))
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://entech.p1ck23.ru',
        'https://entechsite-production.up.railway.app',
        'https://entechsite-backend-production.up.railway.app',
        'https://web.telegram.org',
        'https://webk.telegram.org',
        'https://webz.telegram.org'
    ];
app.use((0, cors_1.default)({
    origin: allowedOrigins,
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
async function startServer() {
    try {
        console.log('🔗 Попытка подключения к базе данных...');
        if (databaseUrl) {
            const maskedUrl = databaseUrl.length > 30
                ? `${databaseUrl.substring(0, 20)}...${databaseUrl.substring(databaseUrl.length - 10)}`
                : '***';
            console.log(`📊 DATABASE_URL: ${maskedUrl}`);
        }
        await pool.query('SELECT 1');
        console.log('✅ Подключение к базе данных установлено');
        await (0, db_init_1.initializeDatabase)(pool);
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        }).on('error', (err) => {
            console.error('❌ Server error:', err);
            process.exit(1);
        });
    }
    catch (error) {
        console.error('❌ Ошибка при запуске сервера:', error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            console.error('\n❌ Не удалось подключиться к базе данных!');
            console.error('\n📝 Инструкция по настройке DATABASE_URL в Railway:');
            console.error('   1. Убедитесь, что PostgreSQL сервис добавлен в проект');
            console.error('   2. В backend сервисе перейдите в "Variables"');
            console.error('   3. Добавьте переменную DATABASE_URL');
            console.error('   4. Значение: ${{Postgres.DATABASE_URL}}');
            console.error('      (замените "Postgres" на имя вашего PostgreSQL сервиса)');
            console.error('   5. Или используйте "Raw Editor" для просмотра всех переменных');
        }
        else if (error.code === '28P01') {
            console.error('❌ Ошибка аутентификации. Проверьте правильность DATABASE_URL.');
        }
        else if (error.code === '3D000') {
            console.error('❌ База данных не существует. Проверьте имя базы данных в DATABASE_URL.');
        }
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map