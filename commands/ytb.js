"use strict";

const yts = require("yt-search");
const ytdl = require("@distube/ytdl-core");
const fs = require("fs-extra");
const path = require("path");
const musicHelper = require("./music");

function safeReact(message, api, event, emoji) {
  if (message && typeof message.react === "function") {
    return Promise.resolve(message.react(emoji)).catch(() => {});
  }
  if (api && typeof api.setMessageReaction === "function") {
    return Promise.resolve(api.setMessageReaction(emoji, event.messageID, event.threadID, () => {}, true)).catch(() => {});
  }
  return Promise.resolve();
}

function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds))) return "";
  const total = Math.max(0, Number(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

async function resolveVideoInfo(query) {
  let videoUrl = String(query || "").trim();
  let title = "YouTube Media";
  let duration = "";

  if (!videoUrl) throw new Error("No YouTube search query or link provided");

  if (!ytdl.validateURL(videoUrl)) {
    const search = await yts(videoUrl);
    const first = search && search.videos && search.videos[0];
    if (!first) throw new Error("No YouTube videos found for this query");
    videoUrl = first.url;
    title = first.title || title;
    duration = first.timestamp || duration;
  }

  let info = null;
  try {
    info = await ytdl.getBasicInfo(videoUrl, {
      requestOptions: {
        maxRetries: 3,
        timeout: 15000
      }
    });
  } catch (_) {
    // If metadata fails, we still have the search title/url to try fallbacks
  }

  const details = info && info.videoDetails ? info.videoDetails : {};
  title = details.title || title;
  const seconds = Number(details.lengthSeconds || 0);
  duration = Number.isFinite(seconds) && seconds > 0 ? formatDuration(seconds) : duration;

  return { videoUrl, title, duration, info };
}

async function buildDownloadStream(videoUrl, isAudio) {
  const info = await ytdl.getBasicInfo(videoUrl, {
    requestOptions: {
      maxRetries: 3,
      timeout: 15000
    }
  });

  const formats = info.formats || [];
  const wanted = isAudio
    ? ytdl.filterFormats(formats, "audioonly")
    : ytdl.filterFormats(formats, "videoandaudio");

  const selected = wanted.find(f => f && f.hasAudio && (!isAudio || f.hasVideo === false)) ||
    wanted[0] ||
    ytdl.chooseFormat(formats, {
      filter: isAudio ? "audioonly" : "videoandaudio",
      quality: isAudio ? "highestaudio" : "highestvideo"
    });

  if (!selected) {
    throw new Error("No supported YouTube format found for this request");
  }

  return {
    info,
    stream: ytdl.downloadFromInfo(info, {
      quality: isAudio ? "highestaudio" : "highestvideo",
      filter: isAudio ? "audioonly" : "videoandaudio",
      highWaterMark: 1 << 24
    })
  };
}

module.exports = {
  config: {
    name: "ytb",
    aliases: ["youtube", "ytdl", "ytd", "yt"],
    version: "2.0.1",
    author: "𝐒𝐈𝐀𝐌 𝐀𝐇𝐌𝐄𝐃 𝐒𝐀𝐀𝐍 & lazyneoaz",
    cooldown: 8,
    role: 0,
    category: "media",
    description: { en: "Download YouTube audio or video directly" },
    usage: { en: "{p}ytb <search or link> [--audio|--video]" }
  },

  onStart: async function ({ message, args, event, api }) {
    const reply = event.messageReply || event.repliedMessage;
    const isAudio = args.includes("--audio") || args.includes("-a") || !args.includes("--video");
    const query = args.filter(a => !a.startsWith("-")).join(" ").trim() || (reply && (reply.body || reply.text)) || "";

    if (!query) {
      return message.reply("▶️ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n\n📌 Usage: {p}ytb <song/video title or link> [--audio|--video]");
    }

    await safeReact(message, api, event, "⏳");

    let tempPath = null;
    let replyMessage = null;

    try {
      const { videoUrl, title, duration } = await resolveVideoInfo(query);
      const ext = isAudio ? "mp3" : "mp4";
      const tempDir = path.join(process.cwd(), "temp");
      await fs.ensureDir(tempDir);
      tempPath = path.join(tempDir, `ytb_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`);

      // Attempt native download with fallbacks
      let downloadSuccess = false;
      try {
        const { stream } = await buildDownloadStream(videoUrl, isAudio);
        const writer = fs.createWriteStream(tempPath);
        stream.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
          stream.on("error", reject);
        });
        if (fs.existsSync(tempPath) && (await fs.stat(tempPath)).size > 1000) {
          downloadSuccess = true;
        }
      } catch (_) {
        downloadSuccess = false;
      }

      // Use specialized fallback providers from music helper if native fails
      if (!downloadSuccess) {
        try {
          const fallbackPath = isAudio 
            ? await musicHelper.downloadYouTubeAudio(videoUrl, title)
            : await musicHelper.downloadYouTubeMedia(videoUrl, title, false);
          
          if (fallbackPath && fs.existsSync(fallbackPath)) {
            await fs.move(fallbackPath, tempPath, { overwrite: true });
            downloadSuccess = true;
          }
        } catch (_) {}
      }

      if (!downloadSuccess) throw new Error("YouTube download failed with all providers.");

      await safeReact(message, api, event, "✅");

      const caption = `▶️ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 [${isAudio ? "AUDIO" : "VIDEO"}]\n📝 ${String(title).slice(0, 100)}${duration ? `\n⏱️ [${duration}]` : ""}`;
      replyMessage = await message.reply({
        body: caption,
        attachment: { path: tempPath, type: isAudio ? "audio" : "video", mimetype: isAudio ? "audio/mp4" : "video/mp4" },
        textFirst: false
      });

      setTimeout(() => {
        if (tempPath) fs.unlink(tempPath).catch(() => {});
      }, 30000);
      return replyMessage;
    } catch (err) {
      const raw = err && err.message ? err.message : String(err || "Unknown error");
      const friendly = /Could not extract|extract downloadable|rate limit|blocked|unavailable|403|ERR_/.test(raw)
        ? "YouTube is currently blocking or rate-limiting downloads from this environment. Try a different link or use a shorter/less restricted URL."
        : raw;

      await safeReact(message, api, event, "❌");
      const errorReply = await message.reply(`❌ YouTube download failed: ${friendly}`);

      setTimeout(() => {
        if (errorReply && typeof message?.unsend === "function") {
          message.unsend(errorReply.messageID || errorReply.id).catch(() => {});
        }
      }, 14000).unref?.();

      if (tempPath) fs.unlink(tempPath).catch(() => {});
      return errorReply;
    }
  }
};
