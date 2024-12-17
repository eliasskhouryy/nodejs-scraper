const Anthropic = require('@anthropic-ai/sdk');
const dotenv = require('dotenv');

dotenv.config();

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

async function claudeAi(input, row) {
	try {
		const message = await anthropic.messages.create({
			model: 'claude-3-haiku-20240307',
			temperature: 0,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: `${input} ${row}`, // Constructing the text prompt from input parameters
						},
					],
				},
			],
		});
		console.log(message.content[0].text);
		return message.content[0].text;
	} catch (error) {
		console.error('Error getting chat completion', error);
		throw error;
	}
}

module.exports = {
	claudeAi,
};
