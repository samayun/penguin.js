# FFMPEG Converter using CLI

## Commands and Usage

```bash

# clone repository & navigate project

# install dependencies
 npm install

# link the CLI commands
npm link
# if doesn't work use  command (for Linux,MAC)
sudo npm link


# get resolution using CLI
resolution https://d1i868qf8ddug0.cloudfront.net/02af4df30c24d23cd0e020e06ef7a524b6211e3becd0bb2a.mp4
resolution input.mp4

# Convert a video to low resolutions using CLI
convert https://d1i868qf8ddug0.cloudfront.net/02af4df30c24d23cd0e020e06ef7a524b6211e3becd0bb2a.mp4
convert input.mp4

# Convert mp4 to m3u8
# it's locally works not cloud :'()
npm run m3u8 input.mp4
npm run m3u8 https://d1i868qf8ddug0.cloudfront.net/02af4df30c24d23cd0e020e06ef7a524b6211e3becd0bb2a.mp4
```
