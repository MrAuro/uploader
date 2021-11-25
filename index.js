const express = require('express');
var multer = require('multer');
const fs = require('fs');
const app = express();
const dotenv = require('dotenv');
dotenv.config();

const KEY = process.env.KEY;
const PORT = process.env.PORT || 9005;
const URL = process.env.URL || `http://localhost:${PORT}`;

if (!KEY) throw new Error('No KEY found in .env');

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		if (req.params.filename) {
			cb(null, './perm/');
		} else {
			cb(null, './uploads/');
		}
	},
	filename: function (req, file, cb) {
		const fileExtension = file.originalname.split('.').pop();
		if (req.params.filename) {
			if (fs.existsSync(`./perm/${req.params.filename}.${fileExtension}`)) {
				fs.renameSync(
					`./perm/${req.params.filename}.${fileExtension}`,
					`./perm/${req.params.filename}-${Date.now()}.${fileExtension}`
				);
				cb(null, `${req.params.filename}.${fileExtension}`);
			} else {
				cb(null, `${req.params.filename}.${fileExtension}`);
			}
		} else {
			let fileName = `${randomString()}.${fileExtension}`;
			while (fs.existsSync(`./uploads/${fileName}`)) {
				fileName = `${randomString()}.${fileExtension}`;
			}

			cb(null, `${fileName}`);
		}
	},
});

// delete uploads over 30 days old
const deleteOldUploads = () => {
	fs.readdir('./uploads', (err, files) => {
		if (err) {
			console.log(err);
			return;
		}

		files.forEach((file) => {
			// ND = non deletion, so dont delete them
			if (!file.startsWith('ND-')) {
				fs.stat(`./uploads/${file}`, (err, stats) => {
					if (err) {
						console.log(err);
						return;
					}

					if (stats.isFile() && stats.ctime < Date.now() - 1000 * 60 * 60 * 24 * 30) {
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

app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: storage });

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/paste_form.html');
});

app.post('/paste', (req, res) => {
	console.log(req.body);
	if (req.body.key !== KEY) return res.send(401).send('Invalid API Key');

	let fileName = randomString() + '.txt';
	while (fs.existsSync(`./uploads/${fileName}`)) {
		fileName = randomString() + '.txt';
	}

	fs.writeFile(`./uploads/${fileName}`, req.body.text, (err) => {
		if (err) {
			console.log(err);
			return res.send(500).send('Internal Server Error');
		}

		res.redirect(`${URL}/${fileName}`);
	});
});

app.get('/:filename', function (req, res, next) {
	console.log(`Requesting ${req.params.filename}`);

	// santize filename
	const filename = req.params.filename.replace(/[^a-zA-Z0-9.\-]/g, '');

	const exists = fs.existsSync(`./uploads/${filename}`);
	const usePerm = fs.existsSync(`./perm/${filename}`);

	console.log(exists, usePerm);

	if (exists) {
		console.log(`Sending ${filename}`);

		res.sendFile(__dirname + `/uploads/${filename}`);
	} else if (usePerm) {
		console.log(`Sending ${filename}`);

		res.sendFile(__dirname + `/perm/${filename}`);
	} else if (filename === 'stats') {
		fs.readdir('./uploads', (err, files) => {
			if (err) {
				console.log(err);
				return;
			}

			const stats = {
				size: 0,
				count: 0,
			};

			files.forEach((file) => {
				stats.count++;
				stats.size += fs.statSync(`./uploads/${file}`).size;
			});

			res.send({
				size: Math.round((stats.size / 1024 / 1024) * 100) / 100,
				count: stats.count,
			});
		});
	} else {
		res.status(404).send(`
        <html>
            <head>
                <title>File Not Found</title>
                <link rel="icon" href="https://cdn.7tv.app/emote/60b65aefbfd59d76c742eaac/3x" />
            </head>
            <body>
		        <img
			        src="https://cdn.7tv.app/emote/60b65aefbfd59d76c742eaac/3x"
			        style="display: block; margin-left: auto; margin-right: auto; width: 20%"
                />
		        <h1 style="text-align: center">File not found</h1>
	        </body>
        </html>
        `);
	}
});

// check if the Authorization header matches KEY
app.use('/', function (req, res, next) {
	if (req.headers.authorization === KEY) {
		return next();
	}
	res.status(401);
});

app.post('/:filename?', upload.single('attachment'), function (req, res, next) {
	console.log(req.file);
	let url = `https://${URL}/${req.file.filename}`;
	res.send({
		url,
	});
});

app.delete('/:filename', function (req, res, next) {
	const filename = req.params.filename.replace(/[^a-zA-Z0-9.\-]/g, '');

	const exists = fs.existsSync(`./uploads/${filename}`);
	const usePerm = fs.existsSync(`./perm/${filename}`);

	if (exists) {
		fs.unlink(`./uploads/${filename}`, (err) => {
			if (err) {
				console.log(err);
				return;
			}
		});
		res.send(`
            <html>
                <head>
                    <title>File deleted</title>
                    <link rel="icon" href="https://cdn.7tv.app/emote/6040aa41cf6746000db1034e/3x" />
                </head>
                <body>
                    <img
                        src="https://cdn.7tv.app/emote/6040aa41cf6746000db1034e/3x"
                        style="display: block; margin-left: auto; margin-right: auto; width: 20%"
                    />
                    <h1 style="text-align: center">File deleted</h1>
                </body>
            </html>
            `);
	} else if (usePerm) {
		fs.unlink(`./perm/${filename}`, (err) => {
			if (err) {
				console.log(err);
				return;
			}
			res.send(`
            <html>
                <head>
                    <title>File deleted</title>
                    <link rel="icon" href="https://cdn.7tv.app/emote/6040aa41cf6746000db1034e/3x" />
                </head>
                <body>
                    <img
                        src="https://cdn.7tv.app/emote/6040aa41cf6746000db1034e/3x"
                        style="display: block; margin-left: auto; margin-right: auto; width: 20%"
                    />
                    <h1 style="text-align: center">File deleted</h1>
                </body>
            </html>
            `);
		});
	} else {
		res.status(404).send(`
        <html>
            <head>
                <title>File Not Found</title>
                <link rel="icon" href="https://cdn.7tv.app/emote/60b65aefbfd59d76c742eaac/3x" />
            </head>
            <body>
		        <img
			        src="https://cdn.7tv.app/emote/60b65aefbfd59d76c742eaac/3x"
			        style="display: block; margin-left: auto; margin-right: auto; width: 20%"
                />
		        <h1 style="text-align: center">File not found</h1>
	        </body>
        </html>
        `);
	}
});

app.listen(PORT, () => {
	console.log(`Server started on port ${PORT}`);
});

function randomString() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 5; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
	return text;
}
