"use strict";

const path = require("path");
const fs = require("fs-extra");
const axios = require("axios");
const yts = require("yt-search");
const ytdl = require("@distube/ytdl-core");
const { compressAudioFile } = require("../src/utils");

function formatDuration(ms) {
	if (!ms || ms < 0) return "0:00";
	const total = ms > 1000 ? Math.round(ms / 1000) : Math.round(ms);
	const minutes = Math.floor(total / 60);
	const seconds = String(total % 60).padStart(2, "0");
	return `${minutes}:${seconds}`;
}

async function searchTracks(query, message, config) {
	const music = (config && config.music) || { };

	async function fromInstagram() {
		const result = await message.musicSearch(query);
		return (result && result.tracks) || [];
	}

	if (music.enable !== false && music.apiUrl) {
		const url = music.apiUrl.includes("{query}")
			? music.apiUrl.replace("{query}", encodeURIComponent(query))
			: `${music.apiUrl}${music.apiUrl.includes("?") ? "&" : "?"}query=${encodeURIComponent(query)}`;
		const headers = { "Accept": "application/json" };
		if (music.apiToken) headers["Authorization"] = `Bearer ${music.apiToken}`;
		try {
			const res = await fetch(url, { headers });
			if (!res.ok) throw new Error(`music server responded ${res.status}`);
			const tracks = normalizeTracks(await res.json());
			if (tracks.length) return tracks;
		}
		catch (_) { }
	}

	return fromInstagram();
}

function normalizeTracks(data) {
	const list = Array.isArray(data) ? data
		: Array.isArray(data && data.tracks) ? data.tracks
			: Array.isArray(data && data.results) ? data.results
				: Array.isArray(data && data.data) ? data.data : [];
	return list.map(entry => ({
		audioAssetID: entry.audioAssetID || entry.audio_asset_id || null,
		audioClusterID: entry.audioClusterID || entry.audio_cluster_id || entry.id || null,
		id: entry.id || entry.audioClusterID || entry.audio_cluster_id || null,
		title: entry.title || entry.name || "Unknown",
		artist: entry.artist || entry.display_artist || "Unknown",
		durationMs: entry.durationMs || entry.duration_ms || entry.duration || 0,
		coverArt: entry.coverArt || entry.cover || entry.thumbnail || null
	})).filter(track => track.audioClusterID || track.audioAssetID);
}

async function sendTrack(message, track) {
	if (!track) return message.reply("That track is no longer available. Search again.");
	try {
		await message.music(track);
	}
	catch (error) {
		return message.reply(`Could not send "${track.title || "the track"}": ${String(error.message || error)}`);
	}
}

async function downloadUrlToTempFile(audioUrl) {
	const tempDir = path.join(process.cwd(), "temp");
	await fs.ensureDir(tempDir);
	const ext = audioUrl.includes(".m4a") ? "m4a" : "mp3";
	const tempPath = path.join(tempDir, `yt_music_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`);
	const res = await axios.get(audioUrl, {
		responseType: "arraybuffer",
		timeout: 30000,
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
		}
	});
	await fs.writeFile(tempPath, Buffer.from(res.data));
	return tempPath;
}

/**
 * Download YouTube media (video or audio) using multiple fallback providers.
 * This fixes 403 Forbidden errors from native ytdl-core.
 */
async function downloadYouTubeMedia(videoUrl, videoTitle, isAudio = true) {
	if (isAudio) return await downloadYouTubeAudio(videoUrl, videoTitle);
	
	const tempDir = path.join(process.cwd(), "temp");
	await fs.ensureDir(tempDir);
	const tempPath = path.join(tempDir, `yt_vdo_${Date.now()}.mp4`);

	const providers = [
		async () => {
			const ttRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`, { timeout: 12000 });
			return ttRes.data?.data?.play || ttRes.data?.data?.wmplay;
		},
		async () => {
			const neoRes = await axios.get(`https://alldl.neokex.xyz/api/alldl?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
			const d = neoRes.data?.metadata?.data || neoRes.data?.data;
			const dl = d?.downloads?.find(it => it.ext === "mp4" && !String(it.label).toLowerCase().includes("audio")) || d?.downloads?.[0];
			return dl?.url;
		},
		async () => {
			const res = await axios.post("https://api.cobalt.tools/api/json", { url: videoUrl, downloadMode: "auto" }, { headers: { Accept: "application/json" }, timeout: 15000 });
			return res.data?.url;
		}
	];

	for (const provider of providers) {
		try {
			const dlUrl = await provider();
			if (dlUrl) {
				const res = await axios.get(dlUrl.startsWith("http") ? dlUrl : `https://www.tikwm.com${dlUrl}`, { responseType: "arraybuffer", timeout: 45000 });
				await fs.writeFile(tempPath, Buffer.from(res.data));
				if ((await fs.stat(tempPath)).size > 1000) return tempPath;
			}
		} catch (_) {}
	}
	throw new Error("Could not extract downloadable YouTube video from any provider");
}

async function downloadYouTubeAudio(videoUrl, videoTitle) {
	if (!videoUrl) throw new Error("No YouTube URL provided to downloader");

	const tempDir = path.join(process.cwd(), "temp");
	await fs.ensureDir(tempDir);
	const tempPath = path.join(tempDir, `yt_music_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`);

	// 1. Native ytdl stream
	if (ytdl.validateURL(videoUrl)) {
		try {
			const stream = ytdl(videoUrl, {
				filter: "audioonly",
				quality: "highestaudio",
				highWaterMark: 1 << 25
			});
			const writer = fs.createWriteStream(tempPath);
			stream.pipe(writer);
			await new Promise((resolve, reject) => {
				writer.on("finish", resolve);
				writer.on("error", reject);
				stream.on("error", reject);
			});
			const stat = await fs.stat(tempPath).catch(() => null);
			if (stat && stat.size > 1000) {
				return await compressAudioFile(tempPath);
			}
			await fs.unlink(tempPath).catch(() => {});
		} catch (_) {
			await fs.unlink(tempPath).catch(() => {});
		}
	}

	// 2. Ryzendesu YTMP3 API
	try {
		const ryzRes = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 20000 });
		const downloadUrl = ryzRes.data?.url || ryzRes.data?.downloadUrl || ryzRes.data?.data?.url;
		if (downloadUrl) {
			const downloaded = await downloadUrlToTempFile(downloadUrl);
			return await compressAudioFile(downloaded);
		}
	} catch (_) {}

	// 3. NeoKEX AllDL Universal
	try {
		const neoRes = await axios.get(`https://alldl.neokex.xyz/api/alldl?url=${encodeURIComponent(videoUrl)}`, { timeout: 20000 });
		const data = (neoRes.data && (neoRes.data.metadata?.data || neoRes.data.data)) || neoRes.data;
		const downloads = (data && data.downloads) || [];
		if (downloads.length > 0) {
			const dl = downloads.find(d => String(d.label || d.ext).toLowerCase().includes("audio") || d.ext === "mp3") || downloads[0];
			if (dl && dl.url) {
				const downloaded = await downloadUrlToTempFile(dl.url);
				return await compressAudioFile(downloaded);
			}
		}
	} catch (_) {}

	// 4. Cobalt API
	try {
		const cobRes = await axios.post("https://api.cobalt.tools/api/json", {
			url: videoUrl,
			downloadMode: "audio"
		}, {
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			timeout: 18000
		});
		if (cobRes.data?.url) {
			const downloaded = await downloadUrlToTempFile(cobRes.data.url);
			return await compressAudioFile(downloaded);
		}
	} catch (_) {}

	// 5. Kaiz API
	try {
		const kaizRes = await axios.get(`https://kaiz-apis.gleeze.com/api/alldl?url=${encodeURIComponent(videoUrl)}`, { timeout: 18000 });
		const kaizAudio = kaizRes.data?.audio || kaizRes.data?.url;
		if (kaizAudio) {
			const downloaded = await downloadUrlToTempFile(kaizAudio);
			return await compressAudioFile(downloaded);
		}
	} catch (_) {}

	// 6. Siputzx API
	try {
		const sipRes = await axios.get(`https://api.siputzx.my.id/api/d/all?url=${encodeURIComponent(videoUrl)}`, { timeout: 18000 });
		const sipAudio = sipRes.data?.data?.audio || sipRes.data?.data?.url || sipRes.data?.result?.audio;
		if (sipAudio) {
			const downloaded = await downloadUrlToTempFile(sipAudio);
			return await compressAudioFile(downloaded);
		}
	} catch (_) {}

	// 7. Preview fallback via iTunes search if we have a song title
	if (videoTitle) {
		const cleanTitle = String(videoTitle)
			.replace(/[\(\[\{].*?[\)\]\}]/g, " ")
			.replace(/official\s*(music\s*)?(video|audio|visualizer|lyric\s*video|mv)?/gi, " ")
			.replace(/[^\w\s]/gi, " ")
			.replace(/\s+/g, " ")
			.trim();
		try {
			const itunesRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&entity=song&limit=1`, { timeout: 8000 });
			const track = itunesRes.data?.results?.[0];
			if (track && track.previewUrl) {
				const downloaded = await downloadUrlToTempFile(track.previewUrl);
				return await compressAudioFile(downloaded);
			}
		} catch (_) {}
	}

	throw new Error("Could not extract downloadable YouTube audio from any provider");
}

module.exports = {
	config: {
		name: "music",
		aliases: ["stickermusic", "sm", "m"],
		author: "Neoaz 🐊 & 𝐒𝐈𝐀𝐌 𝐀𝐇𝐌𝐄𝐃 𝐒𝐀𝐀𝐍",
		category: "media",
		cooldown: 5,
		role: 0,
		description: { en: "Search a song and send as an Instagram music sticker, or use -y to download YouTube audio" },
		usage: { en: "{p}music <song name> | {p}music -y <song name or link> | {p}music <number>" }
	},

	onStart: async function ({ message, args, event, config, usersData, setReplyHandler, api, commandName }) {
		const isYT = args.some(a => ["-y", "--yt", "-yt", "-youtube"].includes(String(a).toLowerCase()));
		const prefix = (config && config.prefix) !== undefined ? config.prefix : "*";

		const safeReact = async (emoji) => {
			try {
				if (message && typeof message.react === "function") return await message.react(emoji);
				if (api && typeof api.setMessageReaction === "function") {
					return await new Promise(resolve => {
						api.setMessageReaction(emoji, event.messageID, event.threadID, () => resolve(), true);
					});
				}
			} catch (_) {}
		};

		// -------------------------------------------------------------
		// 1. YouTube Audio Mode: -y flag
		// -------------------------------------------------------------
		if (isYT) {
			const cleanArgs = args.filter(a => !["-y", "--yt", "-yt", "-youtube"].includes(String(a).toLowerCase()));
			const reply = event.messageReply || event.repliedMessage;
			const ytQuery = cleanArgs.join(" ").trim() || (reply && (reply.body || reply.text)) || "";

			if (!ytQuery) {
				return message.reply(`Usage: ${prefix}music -y <song name or link>\nExample: ${prefix}music -y faded alan walker`);
			}

			await safeReact("⏳");

			let video = null;
			try {
				if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(ytQuery)) {
					const directUrl = ytQuery.startsWith("http") ? ytQuery : `https://${ytQuery}`;
					try {
						const searchRes = await yts({ videoId: ytdl.getURLVideoID(directUrl) });
						video = searchRes;
					} catch (_) {
						video = {
							url: directUrl,
							title: "YouTube Audio",
							author: { name: "YouTube" },
							timestamp: "Live/Audio",
							seconds: 0
						};
					}
				} else {
					const r = await yts(ytQuery);
					const videos = (r && r.videos) || [];
					if (!videos.length) {
						await safeReact("❌");
						return message.reply(`❌ No YouTube audio found for "${ytQuery}".`);
					}
					// Prefer normal length songs (between 30s and 15 mins) over full album compilations or 10-hour loops
					const songsOnly = videos.filter(v => (v.seconds || 0) >= 30 && (v.seconds || 0) <= 900);
					video = songsOnly[0] || videos[0];
				}

				const tempPath = await downloadYouTubeAudio(video.url, video.title);
				const caption = `🎶 ${video.title || "Unknown"}\n👤 ${video.author?.name || "YouTube"}\n⏱️ ${video.timestamp || (video.seconds ? formatDuration(video.seconds * 1000) : "0:00")}\n🔗 ${video.url || ""}`.trim();

				let sent = null;
				try {
					sent = await message.send({
						body: caption,
						attachment: { path: tempPath, type: "audio", mimetype: "audio/mp4" },
						textFirst: false
					});
				} catch (_) {
					sent = await message.reply({
						body: caption,
						attachment: { path: tempPath, type: "audio", mimetype: "audio/mp4" },
						textFirst: false
					});
				}

				await safeReact("✅");
				setTimeout(() => fs.unlink(tempPath).catch(() => {}), 30000);
				return sent;
			} catch (err) {
				await safeReact("❌");
				return message.reply(`❌ YouTube audio download failed: ${err.message || err}`);
			}
		}

		// -------------------------------------------------------------
		// 2. Base Music Sticker Mode: standard Instagram music search
		// -------------------------------------------------------------
		const reply = event.messageReply || event.repliedMessage;
		const query = args.join(" ").trim() || (reply && (reply.body || reply.text)) || "";
		if (!query)
			return message.reply(`Usage: ${prefix}music <song name>\nExample: ${prefix}music blinding lights\nTip: Use ${prefix}music -y <song name> for full YouTube audio.`);

		const last = (usersData && typeof usersData.get === "function") ? (usersData.get(event.senderID) || { }) : { };
		const cached = last.data && last.data.lastMusic;

		if (/^\d+$/.test(query) && cached && Array.isArray(cached.tracks) && cached.tracks.length) {
			const index = Number(query) - 1;
			const track = cached.tracks[index];
			if (!track)
				return message.reply(`Pick a number between 1 and ${cached.tracks.length}.`);
			return sendTrack(message, track);
		}

		let tracks;
		try {
			tracks = await searchTracks(query, message, config);
		}
		catch (error) {
			return message.reply(`Music search failed: ${String(error.message || error)}`);
		}

		if (!tracks.length)
			return message.reply(`No songs found for "${query}".`);

		const top = tracks.slice(0, 10);
		if (usersData && typeof usersData.update === "function") {
			usersData.update(event.senderID, { data: Object.assign({ }, last.data, { lastMusic: { query, tracks: top } }) });
		}

		if (top.length === 1 || args.includes("--top"))
			return sendTrack(message, top[0]);

		const lines = top.map((track, index) =>
			`${index + 1}. ${track.title || "Unknown"} — ${track.artist || "Unknown"} (${formatDuration(track.durationMs)})`
		);
		const sent = await message.reply(
			`Results for "${query}"\n${lines.join("\n")}\n\nReply with music <number> to send one.`
		);

		if (typeof setReplyHandler === "function" && sent?.messageID) {
			setReplyHandler(async ({ message: replyMessage, event: replyEvent }) => {
				const pick = String(replyEvent.body || "").trim().split(/\s+/).pop();
				if (!/^\d+$/.test(pick)) return;
				const chosen = top[Number(pick) - 1];
				if (!chosen) return replyMessage.reply(`Pick a number between 1 and ${top.length}.`);
				await sendTrack(replyMessage, chosen);
			}, sent && sent.messageID);
		}
		return sent;
	},
	downloadYouTubeAudio,
	downloadUrlToTempFile
	downloadUrlToTempFile,
	downloadYouTubeMedia
};
