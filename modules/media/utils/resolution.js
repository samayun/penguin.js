/*
    const FfmpegCommand = require('fluent-ffmpeg');
    const command = new FfmpegCommand();

    const ffmpeg = require("fluent-ffmpeg");
    const command = ffmpeg();
*/

const { promisify } = require("util");
const exec = promisify(require("child_process").exec);

async function getFileResolution(file) {
  // it throws - 1280x720
  const getResolutionCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 ${file}`;
  /* it throws - 
    height=1280
    width=720
    const getResolutionCommand = `ffprobe -v error -show_entries stream=width,height -of default=noprint_wrappers=1 ${file}`;
  */
  const data = await exec(getResolutionCommand);
  return data.stdout;
}

exports.getFileResolution = getFileResolution;
