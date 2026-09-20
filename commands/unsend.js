"use strict";

const HAND_EMOJIS = [
	"✋", "👌", "👍", "👏", "🙌", "👐", "🤲", "🙏", "🗑️", "🗑"
];

module.exports = {
	config: {
		name: "unsend",
		aliases: ["u", "delete", "del"],
		author: "𝐒𝐈𝐀𝐌 𝐀𝐇𝐌𝐄𝐃 𝐒𝐀𝐀𝐍",
		category: "utility",
		cooldown: 1,
		role: 0,
		description: { en: "Unsend a message: reply to any message and the bot removes it, or react with hand/trash emoji as admin" },
		usage: { en: "Reply to a message with {p}unsend or react with ✋/🗑️ to unsend" }
	},

	onStart: async function ({ message, event }) {
		const replied = event.messageReply || event.repliedMessage;
		if (!replied?.messageID) return;
		await message.unsend(replied.messageID).catch(() => {});
	},

	onReaction: async function ({ api, event, role, config }) {
		const reaction = typeof event?.reaction === "string"
			? event.reaction
			: event?.reaction?.emoji || event?.reaction_unicode;
		if (!reaction || event.reactionStatus === "deleted" || event.reaction_status === "deleted") return;
		if (!HAND_EMOJIS.some(emoji => reaction.includes(emoji))) return;

		const targetID = event.targetMessageID || event.target_message_id || event.messageID;
		const threadID = event.threadID || event.thread_id;
		if (!targetID || !threadID || !api?.unsendMessage) return;
		
		if (role < 1) return; // Role 1 is Admin Box, Role 2 is Bot Admin

		await new Promise((resolve, reject) => {
			api.unsendMessage(targetID, threadID, (error, result) =>
				error ? reject(error) : resolve(result)
			);
		}).catch(() => {});
	}
};
