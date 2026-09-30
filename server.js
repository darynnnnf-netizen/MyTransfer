const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

const BUCKET = "files";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 500 * 1024 * 1024
    }
});

const files = new Map();

app.use(express.json());
app.use(express.static("public"));

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post("/upload", upload.single("file"), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            error: "Файл не выбран"
        });
    }

    try {
        const code = generateCode();

        const extension = req.file.originalname.includes(".")
            ? "." + req.file.originalname.split(".").pop()
            : "";

        const fileName =
            crypto.randomBytes(16).toString("hex") + extension;

        console.log("Uploading:", fileName);
        console.log("Bucket:", BUCKET);

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype || "application/octet-stream",
                upsert: false
            });

        if (error) {
            console.error("SUPABASE ERROR:", error);

            return res.status(500).json({
                error: "Supabase: " + error.message
            });
        }

        files.set(code, {
            path: fileName,
            originalname: req.file.originalname,
            size: req.file.size
        });

        console.log("Upload successful:", code);

        res.json({
            success: true,
            code: code,
            filename: req.file.originalname
        });

    } catch (error) {
        console.error("SERVER ERROR:", error);

        res.status(500).json({
            error: "Ошибка сервера: " + error.message
        });
    }
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

app.get("/download/:code", async (req, res) => {

    const data = files.get(req.params.code);

    if (!data) {
        return res.status(404).send("Файл не найден");
    }

    try {
        const { data: file, error } =
            await supabase.storage
                .from(BUCKET)
                .download(data.path);

        if (error || !file) {
            console.error("DOWNLOAD ERROR:", error);

            return res.status(404).send(
                "Файл больше не существует"
            );
        }

        const buffer =
            Buffer.from(await file.arrayBuffer());

        res.setHeader(
            "Content-Type",
            "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(data.originalname)}"`
        );

        res.send(buffer);

    } catch (error) {
        console.error("DOWNLOAD SERVER ERROR:", error);

        res.status(500).send(
            "Ошибка скачивания файла"
        );
    }
});

app.delete("/file/:code", async (req, res) => {

    const data = files.get(req.params.code);

    if (!data) {
        return res.status(404).json({
            error: "Файл не найден"
        });
    }

    try {

        const { error } =
            await supabase.storage
                .from(BUCKET)
                .remove([data.path]);

        if (error) {
            console.error("DELETE ERROR:", error);

            return res.status(500).json({
                error: error.message
            });
        }

        files.delete(req.params.code);

        res.json({
            success: true
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Ошибка удаления"
        });
    }
});

app.listen(PORT, () => {
    console.log(`MyTransfer запущен на порту ${PORT}`);
});
