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
const stream_1 = require("stream");
const auth_1 = __importDefault(require("./routes/auth"));
const employees_1 = __importDefault(require("./routes/employees"));
const courses_1 = __importDefault(require("./routes/courses"));
const lessons_1 = __importDefault(require("./routes/lessons"));
const users_1 = __importDefault(require("./routes/users"));
const events_1 = __importDefault(require("./routes/events"));
const calendar_1 = __importDefault(require("./routes/calendar"));
const bots_1 = __importDefault(require("./routes/bots"));
const upload_1 = __importDefault(require("./routes/upload"));
const db_init_1 = require("./utils/db-init");
const uploads_1 = require("./utils/uploads");
const path_1 = __importDefault(require("path"));
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
        const railwayInternalUrl = 'postgresql://postgres:fMRvspHdgKpSjCIPQDizWQFwpYPNNtJf@postgres.railway.internal:5432/railway';
        console.warn('⚠️ DATABASE_URL не найден в переменных окружения');
        console.warn('📦 Используем fallback Railway internal URL');
        databaseUrl = railwayInternalUrl;
        console.log('\n📊 Доступные переменные PostgreSQL:');
        const pgVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
        pgVars.forEach(key => {
            const value = process.env[key];
            console.log(`   ${key}: ${value ? '✓ установлена' : '✗ не установлена'}`);
        });
        console.log('\n📋 Все переменные, содержащие "DATABASE" или "POSTGRES":');
        const dbRelatedVars = Object.keys(process.env).filter(key => key.toUpperCase().includes('DATABASE') ||
            key.toUpperCase().includes('POSTGRES') ||
            key.toUpperCase().includes('PG'));
        if (dbRelatedVars.length > 0) {
            dbRelatedVars.forEach(key => {
                const value = process.env[key];
                const masked = value && value.length > 30
                    ? `${value.substring(0, 15)}...${value.substring(value.length - 10)}`
                    : (value || '<empty>');
                console.log(`   ${key}: ${masked}`);
            });
        }
        else {
            console.log('   (переменные не найдены)');
        }
    }
    else {
        console.log('✅ DATABASE_URL найден в переменных окружения');
    }
}
const app = (0, express_1.default)();
const pool = new pg_1.Pool({
    connectionString: databaseUrl || 'postgresql://localhost:5432/entechsite',
});
const PORT = parseInt(process.env.PORT || '3001', 10);
console.log(`🔧 PORT from environment: ${process.env.PORT || 'NOT SET'}, using: ${PORT}`);
console.log(`🔧 All environment variables:`, Object.keys(process.env).filter(k => k.includes('PORT') || k.includes('NODE') || k.includes('RAILWAY')));
const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || '';
console.log('🔧 FRONTEND_URL from env:', process.env.FRONTEND_URL);
console.log('🔧 Normalized frontendUrl:', frontendUrl);
const baseOrigins = [
    'https://entech.p1ck23.ru',
    'http://entech.p1ck23.ru',
    'https://entechsite-production.up.railway.app',
    'https://entechsite-frontend-production.up.railway.app',
    'https://entechsite-backend-production.up.railway.app',
    'https://oauth.telegram.org',
    'https://web.telegram.org',
    'https://webk.telegram.org',
    'https://webz.telegram.org',
    'https://telegram.org',
    'https://t.me'
];
if (frontendUrl && !baseOrigins.includes(frontendUrl)) {
    baseOrigins.push(frontendUrl);
}
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? baseOrigins
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        ...baseOrigins
    ];
const uniqueOrigins = Array.from(new Set(allowedOrigins.filter((origin) => Boolean(origin))));
console.log('🌐 Allowed CORS origins:', uniqueOrigins);
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`, {
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent']?.substring(0, 50),
        timestamp: new Date().toISOString()
    });
    next();
});
app.options('*', (req, res) => {
    const origin = req.headers.origin;
    console.log('🔍 OPTIONS preflight request:', {
        origin,
        path: req.path,
        method: req.method,
        'access-control-request-method': req.headers['access-control-request-method'],
        'access-control-request-headers': req.headers['access-control-request-headers']
    });
    if (!origin) {
        console.log('⚠️ OPTIONS request without origin');
        return res.sendStatus(204);
    }
    const normalizedOrigin = origin.replace(/\/$/, '');
    const isAllowed = uniqueOrigins.includes(origin) ||
        uniqueOrigins.includes(normalizedOrigin) ||
        uniqueOrigins.some(allowed => {
            const normalizedAllowed = allowed.replace(/\/$/, '');
            return normalizedAllowed === normalizedOrigin;
        });
    if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        res.setHeader('Access-Control-Max-Age', '86400');
        console.log('✅ OPTIONS allowed for:', origin);
        return res.sendStatus(204);
    }
    else {
        console.warn('❌ OPTIONS blocked for:', origin);
        console.warn('   Normalized:', normalizedOrigin);
        console.warn('   Allowed origins:', uniqueOrigins);
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        return res.status(403).json({ error: 'CORS not allowed', origin, allowedOrigins: uniqueOrigins });
    }
});
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        const normalizedOrigin = origin.replace(/\/$/, '');
        const isAllowed = uniqueOrigins.includes(origin) ||
            uniqueOrigins.includes(normalizedOrigin) ||
            uniqueOrigins.some(allowed => {
                const normalizedAllowed = allowed.replace(/\/$/, '');
                return normalizedAllowed === normalizedOrigin;
            });
        if (isAllowed) {
            console.log('✅ CORS allowed for:', origin);
            callback(null, true);
        }
        else {
            console.warn('❌ CORS blocked for:', origin);
            console.warn('   Normalized:', normalizedOrigin);
            console.warn('   Allowed origins:', uniqueOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400
}));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
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
app.use('/api/bots', bots_1.default);
app.use('/api/upload', upload_1.default);
const uploadsDir = (0, uploads_1.ensureUploadsDir)();
const OPTIMIZABLE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MEDIA_PROXY_ALLOWED_HOSTS = new Set([
    'drive.google.com',
    'docs.google.com',
    'lh3.google.com',
    'lh3.googleusercontent.com',
    'drive.usercontent.google.com',
]);
let cachedSharpModule = null;
let sharpInitAttempted = false;
const getSharpModule = () => {
    if (sharpInitAttempted) {
        return cachedSharpModule;
    }
    sharpInitAttempted = true;
    try {
        cachedSharpModule = require('sharp');
        console.log('✅ Модуль sharp успешно загружен');
        return cachedSharpModule;
    }
    catch (error) {
        cachedSharpModule = null;
        console.warn('⚠️ Модуль sharp недоступен, оптимизация изображений отключена');
        console.warn(error);
        return null;
    }
};
const parsePositiveInt = (value, max) => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return undefined;
    }
    return Math.min(parsed, max);
};
const isResizeFit = (value) => {
    return typeof value === 'string' && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(value);
};
const resolveMediaProxyUrl = (rawUrl) => {
    try {
        const parsedUrl = new URL(rawUrl);
        if (parsedUrl.protocol !== 'https:') {
            return null;
        }
        const hostname = parsedUrl.hostname.toLowerCase();
        const isAllowedHost = MEDIA_PROXY_ALLOWED_HOSTS.has(hostname) || hostname.endsWith('.googleusercontent.com');
        if (!isAllowedHost) {
            return null;
        }
        return parsedUrl;
    }
    catch {
        return null;
    }
};
app.get('/api/media/proxy', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawUrl) {
        res.status(400).json({ message: 'Параметр url обязателен' });
        return;
    }
    const targetUrl = resolveMediaProxyUrl(rawUrl);
    if (!targetUrl) {
        res.status(403).json({ message: 'URL недоступен для проксирования' });
        return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
        const upstreamResponse = await fetch(targetUrl.toString(), {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
                'User-Agent': 'EnTechSite-MediaProxy/1.0',
            }
        });
        if (!upstreamResponse.ok || !upstreamResponse.body) {
            res.status(502).json({
                message: 'Не удалось получить изображение из внешнего источника',
                status: upstreamResponse.status
            });
            return;
        }
        const contentType = (upstreamResponse.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) {
            res.status(415).json({ message: 'Внешний URL не является изображением' });
            return;
        }
        const contentLength = upstreamResponse.headers.get('content-length');
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        res.setHeader('Vary', 'Accept');
        const upstreamStream = stream_1.Readable.fromWeb(upstreamResponse.body);
        upstreamStream.on('error', (streamError) => {
            console.error('Media proxy stream error:', streamError);
            if (!res.headersSent) {
                res.status(502).json({ message: 'Ошибка потока изображения' });
            }
            else {
                res.destroy(streamError);
            }
        });
        upstreamStream.pipe(res);
        return;
    }
    catch (error) {
        if (error?.name === 'AbortError') {
            res.status(504).json({ message: 'Таймаут при загрузке изображения' });
            return;
        }
        console.error('Media proxy error:', error);
        res.status(502).json({ message: 'Ошибка при проксировании изображения' });
        return;
    }
    finally {
        clearTimeout(timeoutId);
    }
});
app.get('/api/uploads/:filename', async (req, res) => {
    const safeFilename = path_1.default.basename(req.params.filename);
    const filePath = (0, uploads_1.resolveUploadedFilePath)(safeFilename);
    if (!filePath) {
        return res.status(404).json({ message: 'Файл не найден' });
    }
    const extension = path_1.default.extname(safeFilename).toLowerCase();
    const canOptimize = OPTIMIZABLE_IMAGE_EXTENSIONS.has(extension);
    const width = parsePositiveInt(req.query.w, 2048);
    const height = parsePositiveInt(req.query.h, 2048);
    const quality = parsePositiveInt(req.query.q, 100);
    const fit = isResizeFit(req.query.fit) ? req.query.fit : 'cover';
    const shouldOptimize = canOptimize && (width !== undefined ||
        height !== undefined ||
        quality !== undefined ||
        req.query.fit !== undefined);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Vary', 'Accept');
    res.setHeader('Cache-Control', shouldOptimize
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=604800, stale-while-revalidate=86400');
    if (!shouldOptimize) {
        return res.sendFile(filePath);
    }
    const sharpModule = getSharpModule();
    if (!sharpModule) {
        return res.sendFile(filePath);
    }
    try {
        const acceptHeader = typeof req.headers.accept === 'string' ? req.headers.accept : '';
        const prefersWebp = acceptHeader.includes('image/webp');
        const normalizedQuality = quality ?? 76;
        let transformer = sharpModule(filePath, { failOn: 'none' }).rotate();
        if (width !== undefined || height !== undefined) {
            transformer = transformer.resize({
                width,
                height,
                fit,
                withoutEnlargement: true
            });
        }
        let transformedBuffer;
        let contentType;
        if (prefersWebp) {
            transformedBuffer = await transformer.webp({ quality: normalizedQuality }).toBuffer();
            contentType = 'image/webp';
        }
        else if (extension === '.png') {
            transformedBuffer = await transformer.png({ compressionLevel: 9 }).toBuffer();
            contentType = 'image/png';
        }
        else {
            transformedBuffer = await transformer.jpeg({ quality: normalizedQuality, mozjpeg: true }).toBuffer();
            contentType = 'image/jpeg';
        }
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', transformedBuffer.length.toString());
        return res.send(transformedBuffer);
    }
    catch (error) {
        console.error('⚠️ Не удалось оптимизировать изображение, отдаем оригинал:', error);
        return res.sendFile(filePath);
    }
});
app.use('/api/uploads', express_1.default.static(uploadsDir, {
    maxAge: '7d',
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    }
}));
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    });
});
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    });
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
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Railway PORT: ${process.env.PORT || 'NOT SET'}`);
    console.log(`📊 Server listening on: 0.0.0.0:${PORT}`);
    console.log('✅ Server is ready to accept requests (database connection will be established in background)');
    const address = server.address();
    if (address) {
        const addrStr = typeof address === 'string' ? address : `${address.address}:${address.port}`;
        console.log(`✅ Server address: ${addrStr}`);
        console.log(`✅ Server is listening and ready to accept connections`);
    }
    console.log(`✅ Health check available at: http://0.0.0.0:${PORT}/api/health`);
}).on('error', (err) => {
    console.error('❌ Server error:', err);
    console.error('❌ Error code:', err.code);
    console.error('❌ Error message:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
    }
    process.exit(1);
});
server.on('clientError', (err, socket) => {
    console.error('❌ Client error:', err.message);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
server.on('close', () => {
    console.log('⚠️ Server closed');
});
async function initializeDatabaseConnection() {
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
        console.log('✅ База данных инициализирована');
    }
    catch (error) {
        console.error('❌ Ошибка при подключении к базе данных:', error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            console.error('\n❌ Не удалось подключиться к базе данных!');
            console.error('\n📝 Инструкция по настройке DATABASE_URL в Railway:');
            console.error('   1. Убедитесь, что PostgreSQL сервис добавлен в проект');
            console.error('   2. В backend сервисе перейдите в "Variables"');
            console.error('   3. Добавьте переменную DATABASE_URL');
            console.error('   4. Значение: ${{Postgres.DATABASE_URL}}');
            console.error('      (замените "Postgres" на имя вашего PostgreSQL сервиса)');
            console.error('   5. Или используйте "Raw Editor" для просмотра всех переменных');
            console.error('\n⚠️ Сервер продолжит работу, но запросы к базе данных будут возвращать ошибки');
        }
        else if (error.code === '28P01') {
            console.error('❌ Ошибка аутентификации. Проверьте правильность DATABASE_URL.');
            console.error('⚠️ Сервер продолжит работу, но запросы к базе данных будут возвращать ошибки');
        }
        else if (error.code === '3D000') {
            console.error('❌ База данных не существует. Проверьте имя базы данных в DATABASE_URL.');
            console.error('⚠️ Сервер продолжит работу, но запросы к базе данных будут возвращать ошибки');
        }
    }
}
initializeDatabaseConnection();
//# sourceMappingURL=index.js.map