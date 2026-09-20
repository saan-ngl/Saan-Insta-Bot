"use strict";

/**
 * Minimal HTTP status server. A Docker host such as Render scans for an open
 * port and treats a service that binds none as unhealthy ("No open ports
 * detected"). The bot itself only makes outbound connections, so this tiny
 * server exists purely to satisfy the platform's port check and to expose a
 * `/health` endpoint.
 *
 * Set PORT=0 to disable it entirely (pure worker mode).
 *
 * Author: Saifullah Al Neoaz (https://github.com/lazyneoaz)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const log = require("./logger");

function createStatusServer(options) {
	const initialPort = options && options.port != null ? Number(options.port) : Number(process.env.PORT || 8080);
	const host = (options && options.host) || "0.0.0.0";
	const info = (options && options.info) || (() => ({}));
	const bot = options && options.bot;

	if (!initialPort) {
		return { start() { }, stop() { }, enabled: false };
	}

	let server = null;
	let currentPort = initialPort;

	function payload() {
		let extra = {};
		try { extra = info() || {}; } catch (_) { extra = {}; }
		return Object.assign({
			ok: true,
			service: "instabot",
			uptime: Math.round(process.uptime())
		}, extra);
	}

	function sendJSON(res, data, status = 200) {
		try {
			const body = JSON.stringify(data);
			res.writeHead(status, {
				"Content-Type": "application/json; charset=utf-8",
				"Content-Length": Buffer.byteLength(body),
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization"
			});
			res.end(body);
		} catch (_) {
			try { res.destroy(); } catch (_) {}
		}
	}

	function handler(req, res) {
		try {
			// CORS preflight
			if (req.method === "OPTIONS") {
				res.writeHead(204, {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Content-Length": "0"
				});
				return res.end();
			}

			const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
			const pathname = urlObj.pathname;

			// Handle HEAD requests
			if (req.method === "HEAD") {
				const body = JSON.stringify(payload());
				res.writeHead(200, {
					"Content-Type": "application/json; charset=utf-8",
					"Content-Length": Buffer.byteLength(body),
					"Access-Control-Allow-Origin": "*"
				});
				return res.end();
			}

			// 1. Dashboard UI route
			if ((pathname === "/" || pathname === "/dashboard") && req.headers.accept && req.headers.accept.includes("text/html")) {
				const dashPath = path.join(__dirname, "..", "dashboard", "index.html");
				if (fs.existsSync(dashPath)) {
					const html = fs.readFileSync(dashPath, "utf8");
					res.writeHead(200, {
						"Content-Type": "text/html; charset=utf-8",
						"Content-Length": Buffer.byteLength(html)
					});
					return res.end(html);
				}
			}

			// 2. Full API Status for dashboard & autoUptime
			if (pathname === "/api/status") {
				const extra = payload();
				const mem = process.memoryUsage();
				const statusData = Object.assign({
					status: extra.online ? "online" : "offline",
					username: extra.bot || "InstaBOT",
					userID: extra.userID || null,
					totalUsers: bot?.database?.users ? bot.database.users.count() : 0,
					commandCount: extra.commands || (bot?.registry?.commands ? bot.registry.commands.size : 77),
					eventCount: extra.events || (bot?.registry?.events ? bot.registry.events.length : 4),
					uptime: Math.round(process.uptime()),
					memory: mem
				}, extra);
				return sendJSON(res, statusData);
			}

			// 3. API Commands list
			if (pathname === "/api/commands") {
				const commands = [];
				if (bot && bot.registry && bot.registry.commands) {
					for (const [name, cmd] of bot.registry.commands.entries()) {
						const conf = cmd.config || {};
						commands.push({
							name,
							category: conf.category || "general",
							description: typeof conf.description === "object" ? (conf.description.en || Object.values(conf.description)[0]) : (conf.description || ""),
							usage: typeof conf.usage === "object" ? (conf.usage.en || Object.values(conf.usage)[0]) : (conf.usage || name),
							prefix: bot.config?.prefix || "*"
						});
					}
				}
				return sendJSON(res, { commands, count: commands.length });
			}

			// 4. API Threads list
			if (pathname === "/api/threads") {
				const threads = [];
				if (bot && bot.database && bot.database.threads) {
					const allThreads = bot.database.threads.all();
					for (const t of allThreads) {
						threads.push({
							threadID: t.threadID,
							name: t.name || (t.isGroup ? `Group ${t.threadID}` : `DM ${t.threadID}`),
							isGroup: Boolean(t.isGroup),
							snippet: t.data?.lastSnippet || "No recent messages"
						});
					}
				}
				return sendJSON(res, { threads, count: threads.length });
			}

			// 5. API Logs stream
			if (pathname === "/api/logs") {
				const logs = typeof log.getRecentLogs === "function" ? log.getRecentLogs() : [];
				return sendJSON(res, { logs });
			}

			// 6. API Diagnostics / Debug
			if (pathname === "/api/debug") {
				const mem = process.memoryUsage();
				return sendJSON(res, {
					node: process.version,
					platform: process.platform,
					pid: process.pid,
					uptime: Math.round(process.uptime()),
					memory: {
						rssMB: (mem.rss / 1024 / 1024).toFixed(1),
						heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
						heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1)
					},
					info: payload()
				});
			}

			// 7. API Database Save Action
			if (pathname === "/api/action/save-db" && req.method === "POST") {
				if (bot && bot.database && typeof bot.database.flush === "function") {
					bot.database.flush();
				}
				return sendJSON(res, { ok: true, message: "Database saved successfully" });
			}

			// Default fallback: Health check JSON payload
			return sendJSON(res, payload());
		}
		catch (_) {
			try { res.destroy(); } catch (_) { /* ignore */ }
		}
	}

	function listenAttempt(portToTry, attemptsLeft = 5) {
		return new Promise((resolve, reject) => {
			const s = http.createServer(handler);
			s.on("error", error => {
				if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
					log.warn("HTTP", `Port ${portToTry} in use, trying ${portToTry + 1}…`);
					try { s.close(); } catch (_) {}
					resolve(listenAttempt(portToTry + 1, attemptsLeft - 1));
				} else {
					log.warn("HTTP", `status server error: ${error && error.message ? error.message : error}`);
					reject(error);
				}
			});
			s.listen(portToTry, host, () => {
				currentPort = portToTry;
				log.info("HTTP", `status server listening on http://${host}:${portToTry}`);
				resolve(s);
			});
		});
	}

	return {
		enabled: true,
		get port() { return currentPort; },
		start() {
			if (server) return Promise.resolve(server);
			return listenAttempt(initialPort).then(s => {
				server = s;
				return server;
			});
		},
		stop() {
			return new Promise(resolve => {
				if (!server) return resolve();
				server.close(() => resolve());
				server = null;
			});
		}
	};
}

module.exports = { createStatusServer };
