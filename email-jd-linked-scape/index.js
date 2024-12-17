const csv = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const {readUrlsFromCsv} = require('./csvReader');

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

let results = [];
let csvFilename;
let currentIndex = 0;
const claudeInput = `Review this job description to find the key skills needed and output in the following sentence structure "I saw your job ad on Linkedin for a (insert role title here) - looks like you are looking for someone (insert few key points that are a hard skillset requirement for a successful applicant to have as listed in the job description. Don't put bonus skillsets or nice to have skillset requirements here). Keep it concise though and after the part in this sentence "looks like you are looking for someone", keep it max 6 words. . I want to understand which are the hard language requirements and what are the nice to have languages, frameworks etc. :`;

async function claudeAi(input, row) {
	try {
		const message = await anthropic.messages.create({
			model: 'claude-3-haiku-20240307',
			max_tokens: 1589,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: `${input} ${row}`,
						},
					],
				},
			],
		});
		console.log('input', input);
		console.log('row', row);
		console.log(message.content[0].text);
		return message.content[0].text;
	} catch (error) {
		console.error('Error getting chat completion', error);
		return `Error in AI interpretation: ${error.message}`;
	}
}

async function writeToCSV(data, filename) {
	const csvWriter = csv({
		path: filename,
		header: [
			{id: 'url', title: 'URL'},
			{id: 'description', title: 'Description'},
			{id: 'aiInterpretation', title: 'AI Interpretation'},
		],
	});

	await csvWriter.writeRecords(data);
	console.log(`Results written to ${filename}`);
}

async function saveProgress() {
	if (results.length > 0) {
		await writeToCSV(results, csvFilename);
		console.log(`Progress saved. Processed ${currentIndex} URLs.`);
	} else {
		console.log('No results to save.');
	}
}

async function processUrlAndDescription(url, description) {
	try {
		const aiInterpretation = await claudeAi(claudeInput, description);
		return {
			url,
			description,
			aiInterpretation,
		};
	} catch (error) {
		console.error(`Error processing ${url}:`, error);
		return {
			url,
			description,
			aiInterpretation: `Error occurred: ${error.message}`,
		};
	}
}

async function processBatch(entries) {
	const batchResults = await Promise.all(entries.map((entry) => processUrlAndDescription(entry.url, entry.description)));
	results.push(...batchResults);
	currentIndex += entries.length;

	if (currentIndex % 10 === 0 || currentIndex === entries.length) {
		await saveProgress();
	}
}

async function main() {
	const entries = await readUrlsFromCsv('./email-jd-linked-scape/linkedin-data.csv');
	csvFilename = `./email-jd-linked-scape/results/scraped_data_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

	const batchSize = 5;
	for (let i = 0; i < entries.length; i += batchSize) {
		const batch = entries.slice(i, i + batchSize);
		await processBatch(batch);
	}
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
	console.log('Received SIGINT. Graceful shutdown start');
	await saveProgress();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('Received SIGTERM. Graceful shutdown start');
	await saveProgress();
	process.exit(0);
});

main().catch(async (error) => {
	console.error('An error occurred in main:', error);
	await saveProgress();
});
