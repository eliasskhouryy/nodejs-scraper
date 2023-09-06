const {chromium} = require('playwright');
const fs = require('fs');
require('dotenv').config();

const loginUrl = 'https://www.linkedin.com/login';
const urls = ['https://www.linkedin.com/company/evocativemedia/people/', 'https://www.linkedin.com/company/moustache-republic/people/'];
const username = process.env.USERNAME;
const password = process.env.PASSWORD;

// Initialize an empty CSV string to store results.
let csvData = `Title,Category,Contains Philippine?\n`;

const writeToFile = (title, categories, fileName) => {
	const csvRows = categories.map((category) => {
		const containsPhilippine = /philippine|philippines/i.test(category) ? 'Yes' : 'No';
		return `${title},${category},${containsPhilippine}`;
	});
	csvData += csvRows.join('\n') + '\n'; // Append to the existing csvData
};

(async () => {
	const browser = await chromium.launch({headless: false});
	const page = await browser.newPage();

	// Navigate to the login page
	await page.goto(loginUrl);

	// Type into the username and password fields
	await page.type('#username', username);
	await page.type('#password', password);

	// Click the login button
	await page.click('[aria-label="Sign in"]');

	// Wait for navigation to complete
	await page.waitForNavigation();

	for (const url of urls) {
		// Navigate to the page you want to scrape
		await page.goto(url);
		await page.waitForSelector('.org-people-bar-graph-element__category');
		await page.waitForTimeout(10000); // Wait for 10 seconds

		// Scrape the data you want
		const scrapedData = await page.evaluate(() => {
			const titleElement = document.querySelector('span[dir="ltr"]');
			const title = titleElement ? titleElement.textContent.trim() : 'No Title';

			const categoryElements = Array.from(document.querySelectorAll('.org-people-bar-graph-module__geo-region .org-people-bar-graph-element__category'));
			const categories = categoryElements.map((element) => element.textContent.trim());

			return {title, categories};
		});

		writeToFile(scrapedData.title, scrapedData.categories);
	}

	// Write the entire CSV data to file at once
	fs.writeFile('data.csv', csvData, (err) => {
		if (err) throw err;
		console.log('Data saved to data.csv');
	});

	await browser.close();
})();
