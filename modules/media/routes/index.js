const router = require("express").Router();
// manual import
const fs = require("fs");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

module.exports = (routes) => {
  routes.use("/api/media", router);

  router.get("/", async (req, res, next) => {
    try {
      return res.json({
        success: true,
        message: "Ping",
        data: "Pong",
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/",

    upload.single("file"),
    // multer({
    //   dest: "uploads/",
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
      try {
        console.log(req.file);
        return res.json({
          success: true,
          message: "Ping",
          data: "Pong",
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/files/:file", (req, res) => {
    // do a bunch of if statements to make sure the user is
    // authorized to view this image, then
    const readStream = fs.createReadStream(`uploads/${req.params.file}`);
    readStream.pipe(res);
  });
};
