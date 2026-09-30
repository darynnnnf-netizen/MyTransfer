const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use(express.json());
app.use(express.static("public"));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const id = crypto.randomBytes(8).toString("hex");
        const ext = path.extname(file.originalname);

        cb(null, id + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024
    }
});

const files = new Map();

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post("/upload", upload.single("file"), (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            error: "Файл не выбран"
        });
    }

    const code = generateCode();

    files.set(code, {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        created: Date.now()
    });

    res.json({
        success: true,
        code: code,
        filename: req.file.originalname
    });
});

app.get("/file/:code", (req, res) => {

    const data = files.get(req.params.code);

    if (!data) {
        return res.status(404).json({
            error: "Файл не найден"
        });
    }

    res.json({
        filename: data.originalname,
        size: data.size
    });
});

app.get("/download/:code", (req, res) => {

    const data = files.get(req.params.code);

    if (!data) {
        return res.status(404).send("Файл не найден");
    }

    const filePath = path.join(uploadDir, data.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Файл больше не существует");
    }

    res.download(filePath, data.originalname);
});

app.delete("/file/:code", (req, res) => {

    const data = files.get(req.params.code);

    if (!data) {
        return res.status(404).json({
            error: "Файл не найден"
        });
    }

    const filePath = path.join(uploadDir, data.filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    files.delete(req.params.code);

    res.json({
        success: true
    });
});

app.listen(PORT, () => {
    console.log(`Сайт запущен: http://localhost:${PORT}`);
});