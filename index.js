const express = require("express");
var multer = require("multer");
const fs = require("fs");
const app = express();

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
        });
    });
};

// every 2 hours delete old uploads
setInterval(deleteOldUploads, 1000 * 60 * 60 * 2);

const upload = multer({ storage: storage });

app.post("/profile", upload.single("avatar"), function (req, res, next) {
    // req.file is the `avatar` file
    // req.body will hold the text fields, if there were any
    console.log(req.file);
    res.json(req.file.filename);
});

// return the avatar as the correct file type
app.get("/profile/:filename", function (req, res, next) {
    // check if file exists
    fs.exists(`./uploads/${req.params.filename}`, function (exists) {
        if (exists) {
            res.sendFile(__dirname + `/uploads/${req.params.filename}`);
        } else {
            res.status(404).send("File not found");
        }
    });
});

app.listen(9005, () => {
    console.log("Server started on port 3000");
});

function randomString() {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
