const util = require("util");
const baseName = require("./baseName");
const exec = util.promisify(require("child_process").exec);

async function convertTom3u8(video) {
  let file = baseName(video);
  const converting = await exec(
    `ffmpeg -i ${video} -hls_time 10  -hls_playlist_type vod -hls_segment_filename "public/${file}%0d.ts" public/${file}.m3u8`
  );
  console.log(converting);
}

module.exports = convertTom3u8;
