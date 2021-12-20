// manual import
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { URL } = require('url');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const upload = multer({ dest: 'public/' });

function sizeTheFile(fileSize) {
    return Math.floor(fileSize / 1024) > 1000 ? Math.floor(fileSize / 1024) / 1000 + 'MB' : Math.floor(fileSize / 1024) + 'KB';
}
const routePath = '/v1/media';
const router = require('express').Router();

module.exports = () => {
    router.get('/', async (req, res, next) => {
        /* #swagger.tags = ['media'] */
        try {
            return res.json({
                success: true,
                message: 'Ping',
                data: 'Pong'
            });
        } catch (error) {
            next(error);
        }
    });

    router.post(
        '/',

        upload.single('file'),
        // multer({
        //   dest: "public/",
        //   upload: null, // take uploading process
        //   inMemory: true, //or false, not needed here

        //   onFileUploadStart: function (file) {
        //     //set upload with WritableStream
        //     this.upload = fs.createWriteStream({
        //       filename: file.originalname,
        //       mode: "w",
        //       chunkSize: 1024 * 4,
        //       content_type: file.mimetype,
        //       root: "fs",
        //       metadata: {}, // put some crazy meta data in here
        //     });
        //   },

        //   onFileUploadData: function (file, data) {
        //     //put the chunks into db
        //     this.upload.write(data);
        //   },

        //   onFileUploadComplete: function (file) {
        //     //end process
        //     this.upload.end();
        //     console.log("successfully written File to MongoDB Gridfs");
        //   },
        // }),
        async (req, res, next) => {
            /* #swagger.tags = ['media'] */
            try {
                console.log(req.file);
                return res.json({
                    success: true,
                    message: 'Ping',
                    data: req.files
                });
            } catch (error) {
                next(error);
            }
        }
    );

    router.get('/files/:file', (req, res, next) => {
        /* #swagger.tags = ['media'] */
        try {
            // do a bunch of if statements to make sure the user is
            // authorized to view this image, then
            const readStream = fs.createReadStream(`public/${req.params.file}`);
            readStream.pipe(res);
        } catch (error) {
            next(error);
        }
    });

    let uploads = {};

    router.post('/upload', (req, res, next) => {
        /* #swagger.tags = ['media'] */
        let fileId = req.headers['x-file-id'];
        let startByte = parseInt(req.headers['x-start-byte'], 10);
        let name = req.headers['name'];
        let fileSize = parseInt(req.headers['size'], 10);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // res.setHeader("Transfer-Encoding", "chunked");

        console.log('file Size', fileSize, fileId, startByte);
        if (uploads[fileId] && fileSize == uploads[fileId].bytesReceived) {
            res.end();
            return;
        }

        console.log(sizeTheFile(fileSize));

        if (!fileId) {
            res.writeHead(400, 'No file id');
            res.end(400);
        }
        console.log(uploads[fileId]);
        if (!uploads[fileId]) uploads[fileId] = {};

        let upload = uploads[fileId];

        let fileStream;

        if (!startByte) {
            upload.bytesReceived = 0;
            let name = req.headers['name'];
            fileStream = fs.createWriteStream(`./uploads/${name}`, {
                flags: 'w'
            });
        } else {
            if (upload.bytesReceived != startByte) {
                res.writeHead(400, 'Wrong start byte');
                res.end(upload.bytesReceived);
                return;
            }
            // append to existing file
            fileStream = fs.createWriteStream(`uploads/${name}`, {
                flags: 'a'
            });
        }

        req.on('data', function (data) {
            //console.log("bytes received", upload.bytesReceived);
            upload.bytesReceived += data.length;
        });

        req.pipe(fileStream);

        // when the request is finished, and all its data is written
        fileStream.on('close', function () {
            console.log(upload.bytesReceived, fileSize);
            if (upload.bytesReceived == fileSize) {
                console.log('Upload finished');
                delete uploads[fileId];

                // can do something else with the uploaded file here
                res.send({ status: 'uploaded' });
                res.end();
            } else {
                // connection lost, we leave the unfinished file around
                console.log('File unfinished, stopped at ' + upload.bytesReceived);
                res.writeHead(500, 'File unfinished, stopped at ' + upload.bytesReceived);
                res.end();
            }
        });

        // in case of I/O error - finish the request
        fileStream.on('error', function (err) {
            console.log('fileStream error', err);
            res.writeHead(500, 'File error');
            res.end();
        });
    });

    async function convertVideoToMultipleResolution(video) {
        // let blob = await File(video)
        const url = URL.createObjectURL(video);
        console.log(url);

        await exec(`ffmpeg -i ${url} -vcodec libx265 -crf 36 public/${video}`);
    }

    router.post('/convert', async (req, res, next) => {
        /* #swagger.tags = ['media'] */
        if (!req.files) {
            return res.status(500).send({ msg: 'file is not found' });
        }
        try {
            // console.log(req.files.video)
            await convertVideoToMultipleResolution(req.files.video);
            res.json({ success: true });
        } catch (error) {
            res.json({ message: error.message });
        }
    });

    router.get('/status', (req, res) => {
        /* #swagger.tags = ['media'] */
        let fileId = req.headers['x-file-id'];
        let name = req.headers['name'];
        let fileSize = parseInt(req.headers['size'], 10);
        console.log(sizeTheFile(fileSize));
        // res.setHeader("Transfer-Encoding", "chunked");

        if (name) {
            try {
                let stats = fs.statSync('public/' + name);
                if (stats.isFile()) {
                    console.log(`fileSize is ${Math.floor(fileSize / 1024) > 1000 ? Math.floor(fileSize / 1024) / 1000 + 'MB' : Math.floor(fileSize / 1024) + 'KB'} and already uploaded file size ${stats.size}`);
                    if (fileSize == stats.size) {
                        res.send({ status: 'file is present', uploaded: stats.size });
                        return;
                    }
                    if (!uploads[fileId]) uploads[fileId] = {};
                    console.log(uploads[fileId]);
                    uploads[fileId]['bytesReceived'] = stats.size;
                    console.log(uploads[fileId], stats.size);
                }
            } catch (er) {}
        }
        let upload = uploads[fileId];

        // res.setHeader("Content-Length",parseInt(req.headers["size"], 10));
        // res.setHeader("Content-Type","application/json; charset=utf-8");

        if (upload) res.status(200).send({ uploaded: upload.bytesReceived });
        else res.send({ uploaded: 0 });
    });

    return {
        path: routePath,
        router
    };
};
