const fs = require('fs');
const csv = require('csv-parser');

function readUrlsFromCsv(filePath, columnName) {
	return new Promise((resolve, reject) => {
		const urls = [];
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (row) => {
				if (row[columnName]) {
					urls.push(row[columnName]);
				}
			})
			.on('end', () => {
				console.log(`${urls.length} URLs read from CSV`);
				resolve(urls);
			})
			.on('error', (error) => {
				reject(error);
			});
	});
}

module.exports = {readUrlsFromCsv};
