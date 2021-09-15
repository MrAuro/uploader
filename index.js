const express = require("express");
var multer = require("multer");
const fs = require("fs");
const app = express();
const dotenv = require("dotenv");
dotenv.config();

const KEY = process.env.KEY;
const PORT = process.env.PORT || 9005;
const URL = process.env.URL;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads/");
    },
    filename: function (req, file, cb) {
        const fileExtension = file.originalname.split(".").pop();
        let fileName = `${randomString()}.${fileExtension}`;
        while (fs.existsSync(`./uploads/${fileName}`)) {
            fileName = `${randomString()}.${fileExtension}`;
        }

        cb(null, `${fileName}`);
    },
});

// delete uploads over 30 days old
const deleteOldUploads = () => {
    fs.readdir("./uploads", (err, files) => {
        if (err) {
            console.log(err);
            return;
        }

        files.forEach((file) => {
            // ND = non deletion, so dont delete them
            if (!file.startsWith("ND-")) {
                fs.stat(`./uploads/${file}`, (err, stats) => {
                    if (err) {
                        console.log(err);
                        return;
                    }

                    if (
                        stats.isFile() &&
                        stats.ctime < Date.now() - 1000 * 60 * 60 * 24 * 30
                    ) {
                        fs.unlink(`./uploads/${file}`, (err) => {
                            if (err) {
                                console.log(err);
                                return;
                            }
                        });
                    }
                });
            }
        });
    });
};

// every 2 hours delete old uploads
setInterval(deleteOldUploads, 1000 * 60 * 60 * 2);

const upload = multer({ storage: storage });

// return the avatar as the correct file type
app.get("/:filename", function (req, res, next) {
    // santize filename
    const filename = req.params.filename.replace(/[^a-zA-Z0-9.\-]/g, "");

    // check if file exists
    fs.exists(`./uploads/${filename}`, function (exists) {
        if (exists) {
            res.sendFile(__dirname + `/uploads/${filename}`);
        } else {
            res.status(404).send("File not found");
        }
    });
});

// check if the Authorization header matches KEY
app.use("/", function (req, res, next) {
    if (req.headers.authorization === KEY) {
        return next();
    }
    res.status(401);
});

app.post("/", upload.single("attachment"), function (req, res, next) {
    console.log(req.file);
    let url = `https://${URL}/${req.file.filename}`;
    res.send({
        url,
    });
});

app.delete("/:filename", function (req, res, next) {
    const filename = req.params.filename.replace(/[^a-zA-Z0-9.\-]/g, "");

    // check if file exists
    fs.exists(`./uploads/${filename}`, function (exists) {
        if (exists) {
            fs.unlink(`./uploads/${filename}`, (err) => {
                if (err) {
                    console.log(err);
                    return;
                }
            });
            res.send("File deleted");
        } else {
            res.status(404).send("File not found");
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

function randomString() {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
