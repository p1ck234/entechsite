"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const uploadsDir = process.env.NODE_ENV === 'production'
    ? path_1.default.join(__dirname, '../uploads')
    : path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Создана папка для загрузок: ${uploadsDir}`);
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, `photo-${uniqueSuffix}${ext}`);
    }
});
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    }
    else {
        cb(new Error('Разрешены только изображения (jpeg, jpg, png, gif, webp)'));
    }
};
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: fileFilter
});
router.post('/', auth_1.authenticateToken, (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err instanceof multer_1.default.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: 'Размер файла превышает 5MB' });
                }
                return res.status(400).json({ message: err.message || 'Ошибка при загрузке файла' });
            }
            return res.status(400).json({ message: err.message || 'Ошибка при загрузке файла' });
        }
        next();
    });
}, (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Файл не был загружен' });
        }
        console.log('File uploaded:', {
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: req.file.path
        });
        const fileUrl = `/api/uploads/${req.file.filename}`;
        res.json({
            message: 'Файл успешно загружен',
            url: fileUrl,
            filename: req.file.filename
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message || 'Ошибка при загрузке файла' });
    }
});
router.get('/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path_1.default.join(uploadsDir, filename);
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ message: 'Файл не найден' });
        }
        res.sendFile(filePath);
    }
    catch (error) {
        console.error('Get file error:', error);
        res.status(500).json({ message: 'Ошибка при получении файла' });
    }
});
router.delete('/:filename', auth_1.authenticateToken, (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path_1.default.join(uploadsDir, filename);
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ message: 'Файл не найден' });
        }
        fs_1.default.unlinkSync(filePath);
        res.json({ message: 'Файл успешно удален' });
    }
    catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ message: 'Ошибка при удалении файла' });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map