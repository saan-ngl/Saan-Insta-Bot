"use strict";

/**
 * onReaction — runs for reaction events.
 * Removes messages that an authorised user marks with a hand or trash emoji.
 */

const log = require("../src/logger");

const HAND_EMOJIS = [
	"✋", "👌", "👍", "👏", "🙌", "👐", "🤲", "🙏", "🗑️", "🗑"
];

module.exports = {
	config: {
		name: "onReaction",
		category: "system",
		eventType: "message_reaction"
	},

	onStart: async function ({ event, bot, api, config, threadData }) {
		const reaction = typeof event?.reaction === "string"
			? event.reaction
			: event?.reaction?.emoji;
		if (!reaction || event.reactionStatus === "deleted") return;
		if (!HAND_EMOJIS.some(emoji => reaction.includes(emoji))) return;

		const senderID = String(event.senderID || event.userID || "").trim();
		const targetID = String(event.targetMessageID || event.target_message_id || "").trim();
		const eventThreadID = event.threadID || event.thread_id;
		if (!senderID || !targetID || !eventThreadID) return;

		const client = api || bot?.api;
		if (!client || typeof client.unsendMessage !== "function") return;

		const botID = String(
			(client && typeof client.getCurrentUserID === "function" && client.getCurrentUserID()) ||
			bot?.userID || ""
		).trim();
		const cached = global.recentMessages?.get?.(targetID);
		// Instagram only allows the bot to unsend its own messages.
		if (cached?.senderID && botID && String(cached.senderID) !== botID) return;

		const configuredAdmins = [
			...(Array.isArray(config?.adminBot) ? config.adminBot : []),
			...(Array.isArray(config?.ADMIN_BOT) ? config.ADMIN_BOT : []),
			...(Array.isArray(config?.devUsers) ? config.devUsers : []),
			...(Array.isArray(config?.DEV_USERS) ? config.DEV_USERS : [])
		].map(String);
		const rawAdmins = threadData?.adminIDs || threadData?.adminIds || threadData?.admin_ids || [];
		const threadAdmins = (Array.isArray(rawAdmins) ? rawAdmins : []).map(admin =>
			String(typeof admin === "object" ? (admin.id || admin.userID || admin.pk || admin.uid || "") : admin)
		);
		const isBotAdmin = botID && senderID === botID;
		const isDM = event.isGroup === false || event.isGroup == null;
		if (!isBotAdmin && !configuredAdmins.includes(senderID) && !threadAdmins.includes(senderID) && !isDM) return;

		try {
			await new Promise((resolve, reject) => {
				client.unsendMessage(targetID, eventThreadID, (error, result) =>
					error ? reject(error) : resolve(result)
				);
			});
			log.info("REACTION", `${senderID} removed message ${targetID} via reaction ${reaction}`);
		} catch (error) {
			log.warn("REACTION", `Could not remove ${targetID}: ${error?.message || error}`);
		}
	}
};
