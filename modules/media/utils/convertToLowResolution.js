const util = require("util");
const exec = util.promisify(require("child_process").exec);
const ffmpeg = require("fluent-ffmpeg");
const { getFileResolution } = require("./resolution");
const baseName = require("./baseName");

// function convertVideoToMultipleResolution(video) {
//   exec(`ffmpeg -i ${video} -vcodec libx265 -crf 36 public/${video}`);
// }

async function convertToLowResolution(filename) {
  if (!filename) {
    throw new Error(`Please input file`);
  }
  try {
    const basename = baseName(filename);

    let resolution = await getFileResolution(filename);

    console.log(`resolution ${resolution} ${filename} file is converting... `);

    getConvertionFunc(filename, basename, resolution)
      .on("error", function (err) {
        console.log(err);
        console.log("An error occurred: " + err.message);
      })
      .on("progress", function (progress) {
        console.log(
          `Uploading : ${progress.currentKbps} /-  frames: ${progress.frames}`
        );
      })
      .on("end", function () {
        console.log("Finished processing");
      })
      .run();
  } catch (error) {
    console.log(error.message);
  }
}

function getConvertionFunc(filename, basename, resolution) {
  if (+resolution.split("x")[0] > 1280) {
    console.log("1st");
    return ffmpeg(filename)
      .output("public/" + basename + "-1280x1280.mp4")
      .videoCodec("libx264")
      .size("1280x1280")

      .output("public/" + basename + "-720x720.mp4")
      .videoCodec("libx264")
      .size("720x720")

      .output("public/" + basename + "-480x480.mp4")
      .videoCodec("libx264")
      .size("480x480")

      .output("public/" + basename + "-360x360.mp4")
      .videoCodec("libx264")
      .size("360x360");
  } else if (+resolution.split("x")[0] == 1280) {
    console.log("2nd");
    return ffmpeg(filename)
      .output("public/" + basename + "-720x720.mp4")
      .videoCodec("libx264")
      .size("720x720")

      .output("public/" + basename + "-480x480.mp4")
      .videoCodec("libx264")
      .size("480x480")

      .output("public/" + basename + "-360x360.mp4")
      .videoCodec("libx264")
      .size("360x360");
  } else if (+resolution.split("x")[0] >= 720) {
    return ffmpeg(filename)
      .output("public/" + basename + "-480x480.mp4")
      .videoCodec("libx264")
      .size("480x480")
      .output("public/" + basename + "-360x360.mp4")
      .videoCodec("libx264")
      .size("360x360");
  } else if (+resolution.split("x")[0] >= 520) {
    return ffmpeg(filename)
      .output("public/" + basename + "-480x480.mp4")
      .videoCodec("libx264")
      .size("480x480")
      .output("public/" + basename + "-360x360.mp4")
      .videoCodec("libx264")
      .size("360x360");
  } else if (+resolution.split("x")[0] > 360) {
    return ffmpeg(filename)
      .output("public/" + basename + "-360x360.mp4")
      .videoCodec("libx264")
      .size("360x360");
  }
}

module.exports = convertToLowResolution;
