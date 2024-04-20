#!/usr/bin/env node

import ytdl from "ytdl-core";
import fs from "fs";
import cliProgress from "cli-progress";
import ffmpeg from "ffmpeg-static";
import { exec } from "child_process";
import chalk from "chalk";
import emojiStrip from "emoji-strip";
import os from "os";
import path from "path";
import inquirer from "inquirer";
("process");
import { Command } from "commander";
import chalkAnimation from "chalk-animation";
import { createSpinner } from "nanospinner";
const program = new Command();
program.version("1.0.0");
const toMB = (i) => (i / 1024 / 1024).toFixed(2);
program.description("Download a video from YouTube").action(async () => {
  const { url } = await inquirer.prompt([
    {
      type: "input",
      name: "url",
      message: "Enter the URL of the YouTube video:",
    },
  ]);
  await downloadVideo(url);
});

const removeSpecialCharacters = (str) => {
  return str.replace(/[<>:"/\\|?*]+/g, "");
};

const getDownloadsFolder = () => {
  return path.join(os.homedir(), "Downloads");
};

const createDirectoryIfNotExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const downloadStreams = async (videoInfo, videoTempPath, audioTempPath) => {
  const spinnerVideo = createSpinner("Downloading Video....").start();
  const spinnerAudio = createSpinner("Downloading Audio....").start();
  try {
    const videoFormat = ytdl.chooseFormat(videoInfo.formats, {
      quality: "highestvideo",
    });
    const audioFormat = ytdl.chooseFormat(videoInfo.formats, {
      quality: "highestaudio",
    });

    if (!videoFormat || !audioFormat) {
      throw new Error("Failed to get video or audio format");
    }

    const expectedVideoSize = toMB(videoFormat.contentLength);

    const videoStream = ytdl.downloadFromInfo(videoInfo, {
      format: videoFormat,
    });
    const audioStream = ytdl.downloadFromInfo(videoInfo, {
      format: audioFormat,
    });

    videoStream.pipe(fs.createWriteStream(videoTempPath));
    audioStream.pipe(fs.createWriteStream(audioTempPath));

    videoStream.on("progress", (_, downloaded, total) => {
      const downloadedVideoMB = toMB(downloaded);
      const totalVideoMB = toMB(total);
      spinnerVideo.update({
        text: `Downloading Video ${downloadedVideoMB} MB / ${totalVideoMB} MB`,
      });
    });
    audioStream.on("progress", (_, downloaded, total) => {
      const downloadedAudioMB = toMB(downloaded);
      const totalAudioMB = toMB(total);
      spinnerAudio.update({
        text: `Downloading Audio ${downloadedAudioMB} MB / ${totalAudioMB} MB`,
      });
    });

    await Promise.all([
      new Promise((resolve) => {
        videoStream.on("end", () => {
          spinnerVideo.success("Video Downloaded Completed");
          resolve();
        });
      }),
      new Promise((resolve) => {
        audioStream.on("end", () => {
          spinnerAudio.success("Audio Downloaded Completed");
          resolve();
        });
      }),
    ]);
  } catch (error) {
    spinnerVideo.error("Video Download failed");
    spinnerAudio.error("Audio Download failed");
    throw error;
  }
};

const mergeStreams = async (
  videoTempPath,
  audioTempPath,
  outputPath,
  videoTitle
) => {
  const spinnerMerge = createSpinner("Merging....").start();
  try {
    const mergeCommand = `"${ffmpeg}" -i "${videoTempPath}" -i "${audioTempPath}" -c:v copy -c:a aac "${outputPath}"`;
    await exec(mergeCommand, (error, stdout, stderr) => {
      if (error) {
        console.log(chalk.redBright(`Merging unsuccessful`));
        spinnerMerge.error();
      } else {
        spinnerMerge.success();
        fs.unlinkSync(videoTempPath);
        fs.unlinkSync(audioTempPath);
        rainBowTextAnimation(`\nDownload Completed ${videoTitle}\n`);
      }
    });
  } catch (error) {
    spinnerMerge.error("Error occurred while merging streams:", error);
    throw error;
  }
};
const sleep = (ms = 2000) => new Promise((res) => setTimeout(res, ms));
const rainBowTextAnimation = async (text) => {
  const rainbowTitle = chalkAnimation.rainbow(text);
  await sleep();
  rainbowTitle.stop();
};
const downloadVideo = async (url) => {
  try {
    if (!url) {
      throw new Error("Invalid URL provided");
    }
    console.clear();
    rainBowTextAnimation(
      "\nYoutube Video Downloader Developed by Nazeef Masood\n"
    );
    const videoInfo = await ytdl.getInfo(url);

    const videoTitle = videoInfo.videoDetails.title;
    const cleanTitle = removeSpecialCharacters(emojiStrip(videoTitle));

    const downloadsFolder = getDownloadsFolder();
    const outputFolder = path.join(downloadsFolder, "Youtube Downloads");
    const tempFolder = path.join(outputFolder, "temp");
    const videoTempPath = path.join(tempFolder, `${cleanTitle}_video.mp4`);
    const audioTempPath = path.join(tempFolder, `${cleanTitle}_audio.m4a`);
    const outputPath = path.join(outputFolder, `${cleanTitle}.mp4`);

    createDirectoryIfNotExists(outputFolder);
    createDirectoryIfNotExists(tempFolder);

    if (fs.existsSync(outputPath)) {
      const spinner = createSpinner(
        "Output File found:  Deleting it and then re-downloading "
      ).start();
      fs.unlinkSync(outputPath);
      spinner.success();
    }
    if (fs.existsSync(videoTempPath)) {
      const spinnerVideo = createSpinner(
        "Video File found:  Deleting it and then re-downloading "
      ).start();
      fs.unlinkSync(videoTempPath);
      spinnerVideo.success();
    }
    if (fs.existsSync(audioTempPath)) {
      const spinnerAudio = createSpinner(
        "Audio File found:  Deleting it and then re-downloading "
      ).start();
      fs.unlinkSync(audioTempPath);
      spinnerAudio.success();
    }

    await downloadStreams(videoInfo, videoTempPath, audioTempPath);
    await mergeStreams(videoTempPath, audioTempPath, outputPath, videoTitle);
  } catch (error) {
    console.error(chalk.redBright("An error occurred:", error.message));
  }
};

program.parse(process.argv);
