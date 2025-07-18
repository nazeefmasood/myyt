#!/usr/bin/env node

import youtubeDl from "youtube-dl-exec";
import fs from "fs";
import chalk from "chalk";
import emojiStrip from "emoji-strip";
import os from "os";
import path from "path";
import inquirer from "inquirer";
import { Command } from "commander";
import chalkAnimation from "chalk-animation";
import { createSpinner } from "nanospinner";
import { exec } from "child_process";
import ffmpegPath from "ffmpeg-static"; 
import createLogger from "progress-estimator"; 

const program = new Command();
program.version("1.0.0");

const logger = createLogger(); // Initialize the progress-estimator

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

    const downloadsFolder = getDownloadsFolder();
    const tempFolder = path.join(downloadsFolder, "Youtube Downloads", "temp");
    const outputFolder = path.join(downloadsFolder, "Youtube Downloads");
    createDirectoryIfNotExists(tempFolder);
    createDirectoryIfNotExists(outputFolder);

    const spinner = createSpinner("Getting video information...").start();
    let videoInfo;
    try {
      videoInfo = await youtubeDl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
          "referer:youtube.com",
          "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        ],
      });
      spinner.success("Video information retrieved");
    } catch (error) {
      spinner.error("Failed to retrieve video information");
      console.error(chalk.redBright("Error details:", error.message));
      return;
    }

    const videoTitle = videoInfo.title;
    const cleanTitle = removeSpecialCharacters(emojiStrip(videoTitle));
    const videoPath = path.join(tempFolder, `${cleanTitle}.video.webm`);
    const audioPath = path.join(tempFolder, `${cleanTitle}.audio.webm`);
    const outputPath = path.join(outputFolder, `${cleanTitle}.mp4`);

    if (fs.existsSync(outputPath)) {
      const spinner = createSpinner(
        "Output file found: Deleting it and then re-downloading"
      ).start();
      fs.unlinkSync(outputPath);
      spinner.success();
    }

    console.log(chalk.cyan("Starting download..."));

    const videoDownload = youtubeDl(url, {
      output: videoPath,
      format: "bestvideo",
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        "referer:youtube.com",
        "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      ],
    });

    const audioDownload = youtubeDl(url, {
      output: audioPath,
      format: "bestaudio",
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        "referer:youtube.com",
        "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      ],
    });

    // Use progress-estimator for video and audio download
    await logger(videoDownload, `Downloading video: ${videoTitle}`);
    await logger(audioDownload, `Downloading audio: ${videoTitle}`);

    console.log(chalk.green("\nDownload completed successfully!\n"));

    // Merging video and audio using ffmpeg-static
    const mergeSpinner = createSpinner("Merging audio and video...").start();
    const mergeCommand = `${ffmpegPath} -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac "${outputPath}"`;

    exec(mergeCommand, (error, stdout, stderr) => {
      if (error) {
        mergeSpinner.error("Failed to merge files");
        console.error(chalk.redBright("Merge error:", error.message));
        return;
      }

      mergeSpinner.success("Merge completed successfully!");
      fs.unlinkSync(videoPath);
      fs.unlinkSync(audioPath);
      rainBowTextAnimation(`\nDownload Completed: ${videoTitle}\n`);
    });
  } catch (error) {
    console.error(chalk.redBright("An error occurred:", error.message));
  }
};

program.parse(process.argv);
