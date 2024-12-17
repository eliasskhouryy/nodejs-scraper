const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const {readUrlsFromCsv} = require('./csvReader');
const OpenAI = require('openai');
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

let results = [];
let csvFilename;
let currentIndex = 0;

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
		console.log(message.content[0].text);
		return message.content[0].text;
	} catch (error) {
		console.error('Error getting chat completion', error);
		return `Error in AI interpretation: ${error.message}`;
	}
}

async function openaiAi(input, row) {
	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [{role: 'user', content: `${input} ${row}`}],
		});
		console.log(response.choices[0].message.content);
		return response.choices[0].message.content;
	} catch (error) {
		console.error('Error getting chat completion', error);
		return `Error in AI interpretation: ${error.message}`;
	}
}

async function scrapeWebpage(url) {
	try {
		const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `http://${url}`;
		const response = await axios.get(fullUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36',
			},
			timeout: 60000,
		});

		const $ = cheerio.load(response.data);

		// Remove script and style elements
		$('script, style').remove();

		// Get visible text
		const text = $('body').text().replace(/\s+/g, ' ').trim();

		return text;
	} catch (error) {
		console.error(`Error scraping ${url}:`, error);
		return `Error scraping webpage: ${error.message}`;
	}
}

async function writeToCSV(data, filename) {
	const csvWriter = csv({
		path: filename,
		header: [
			{id: 'url', title: 'URL'},
			{id: 'bodyText', title: 'Body Text'},
			{id: 'aiInterpretation', title: 'AI Interpretation'},
		],
	});

	await csvWriter.writeRecords(data);
	console.log(`Results written to ${filename}`);
}

const claudeInput = `Review the body text of the following website and provide a response in this exact format:
  
  "Since it looks like your team is focused on [2-8 word description of the company's focus, as a complete and grammatically correct sentence] - ever thought about hiring for a [Technical Role 1] or [Technical Role 2] in the Philippines?"
  
  Replace the bracketed sections with appropriate content based on the website's body text. Ensure the company description is concise and simple and fits seamlessly into the sentence. Choose two relevant technical roles that would be applicable for the company's services. Do not include any quotation marks in the final output. Here's the body text to review:`;

async function saveProgress() {
	if (results.length > 0) {
		await writeToCSV(results, csvFilename);
		console.log(`Progress saved. Processed ${currentIndex} URLs.`);
	} else {
		console.log('No results to save.');
	}
}

async function processUrl(url) {
	try {
		const scrapedText = await scrapeWebpage(url);
		console.log(`Scraped text from ${url}`);
		const aiInterpretation = await claudeAi(claudeInput, scrapedText);
		// const aiInterpretation = await openaiAi(claudeInput, scrapedText);
		return {
			url,
			bodyText: scrapedText,
			aiInterpretation,
		};
	} catch (error) {
		console.error(`Error processing ${url}:`, error);
		return {
			url,
			bodyText: `Error occurred: ${error.message}`,
			aiInterpretation: 'Error occurred',
		};
	}
}

async function processBatch(urls) {
	const batchResults = await Promise.all(urls.map(processUrl));
	results.push(...batchResults);
	currentIndex += urls.length;

	if (currentIndex % 10 === 0 || currentIndex === urls.length) {
		await saveProgress();
	}
}

async function main() {
	const urls = await readUrlsFromCsv('./email-blast/data1.csv', 'organization_primary_domain');
	csvFilename = `./email-blast/results/scraped_data_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

	const batchSize = 5;
	for (let i = 0; i < urls.length; i += batchSize) {
		const batch = urls.slice(i, i + batchSize);
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
