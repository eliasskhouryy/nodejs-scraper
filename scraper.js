const {chromium} = require('playwright');
const fs = require('fs');
const {linkedinCompanyProfiles} = require('./urls');
require('dotenv').config();

const loginUrl = 'https://www.linkedin.com/login';
const urls = linkedinCompanyProfiles;
const username = process.env.USERNAME;
const password = process.env.PASSWORD;

// Initialize an empty CSV string to store results.
let csvData = `Company,Contains Philippine?,Link,Name,Role,Website,Industry,Company size,Headquaters\n`;

function formatTwoDigits(number) {
	return number.toString().padStart(2, '0');
}
// Get the current date
const currentDate = new Date();

// Format the date as "ddmmyyyy"
const formattedDate = `${formatTwoDigits(currentDate.getDate())}${formatTwoDigits(currentDate.getMonth() + 1)}${currentDate.getFullYear()}`;

// Create the filename with the formatted date
const filename = `scraped_data/linkedIn_data_${formattedDate}.csv`;

const writeToFile = (title, categories, link, roles, website, industry, companySize, headquaters) => {
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

		csvRow = `"${title}","${answer}","${link}","${name}","${role}","${website}","${industry}","${companySize}","${headquaters}"\n`;

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
		await page.goto(url + '/people/', {waitUntil: 'domcontentloaded'});

		// await page.waitForSelector('.org-people-bar-graph-element__category');
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

		const businessDevelopmentRoles = await page.$$eval('.artdeco-entity-lockup--stacked-center .lt-line-clamp', (elements) => elements.map((element) => element.textContent.trim()));
		console.log('title:', businessDevelopmentRoles);

		await page.goto(url + '/about/', {waitUntil: 'domcontentloaded'});
		await page.waitForTimeout(10000); // Wait for 10 seconds
		const aboutData = await page.evaluate(() => {
			// website
			const websiteElement = Array.from(document.querySelectorAll('.org-page-details-module__card-spacing .link-without-visited-state'));
			let website = websiteElement.map((element) => element.textContent.trim());
			website = website[0];

			// Industry & Company Size
			const industryElements = Array.from(document.querySelectorAll('.org-page-details-module__card-spacing .text-body-medium'));
			const capturedData = industryElements.map((element) => element.textContent.trim());
			let industry;
			let companySize;
			if (/\d/.test(capturedData[2])) {
				industry = capturedData[3];
				companySize = capturedData[4];
			} else {
				industry = capturedData[2];
				companySize = capturedData[3];
			}

			const headquatersElement = document.querySelector('.org-locations-module__card-spacing .break-words');
			const headquaters = headquatersElement ? headquatersElement.textContent.trim() : 'No Headquaters';

			return {website, industry, companySize, headquaters};
		});

		console.log('website:', aboutData.website);
		console.log('industry:', aboutData.industry);
		console.log('company size:', aboutData.companySize);
		console.log('headquaters:', aboutData.headquaters);

		writeToFile(scrapedData.title, scrapedData.categories, url, businessDevelopmentRoles, aboutData.website, aboutData.industry, aboutData.companySize, aboutData.headquaters);
	}

	// Write the entire CSV data to file at once
	fs.writeFile(filename, csvData, (err) => {
		if (err) throw err;
		console.log('Data saved to data.csv');
	});

	await browser.close();
})();
