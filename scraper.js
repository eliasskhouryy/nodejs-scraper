const {chromium} = require('playwright');
const fs = require('fs');
require('dotenv').config();

const loginUrl = 'https://www.linkedin.com/login';
const urls = [
	'https://www.linkedin.com/company/evocativemedia/',
	'https://www.linkedin.com/company/moustache-republic/',
	'https://www.linkedin.com/company/evocativemedia/',
	'https://www.linkedin.com/company/moustache-republic/',
];
const username = process.env.USERNAME;
const password = process.env.PASSWORD;

// Initialize an empty CSV string to store results.
let csvData = `Company,Contains Philippine?,Link,Name,Role\n`;

const writeToFile = (title, categories, link, roles) => {
	// Check if any categories contain "Philippines" or "Philippine"
	let headerWritten = false; // Flag to track if the header has been written
	const hasPhilippine = categories.some((category) => /philippine|philippines/i.test(category));
	// Write either "Yes" or "No" based on the presence of the desired category
	const answer = hasPhilippine ? 'Yes' : 'No';

	for (let i = 0; i < roles.length; i += 2) {
		const name = roles[i] || ''; // default to empty string if undefined
		const role = roles[i + 1] || ''; // default to empty string if undefined

		// Initialize the CSV row
		let csvRow = '';

		csvRow = `${title},${answer},${link},${name},"${role}"\n`;

		csvData += csvRow;
	}
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
		await page.goto(url + 'people/');
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

		const businessDevelopmentElements = await page.$$('.org-people-bar-graph-element__category');

		for (const element of businessDevelopmentElements) {
			const textContent = await element.textContent();
			if (textContent == 'Business Development') {
				await element.click();
				await page.waitForTimeout(10000); // Wait for 10 seconds
				break;
			}
		}

		// const businessDevelopmentNames = await page.$$eval('.org-people-profile-card__profile-title', (elements) => elements.map((element) => element.textContent.trim()));
		// console.log('businessDevelopmentNames', businessDevelopmentNames);

		const businessDevelopmentRoles = await page.$$eval('.artdeco-entity-lockup--stacked-center .lt-line-clamp', (elements) => elements.map((element) => element.textContent.trim()));
		console.log('businessDevelopmentRole', businessDevelopmentRoles);

		writeToFile(scrapedData.title, scrapedData.categories, url, businessDevelopmentRoles);
	}

	// Write the entire CSV data to file at once
	fs.writeFile('data.csv', csvData, (err) => {
		if (err) throw err;
		console.log('Data saved to data.csv');
	});

	await browser.close();
})();
