const fs = require('fs');
const csv = require('csv-parser');

function readUrlsFromCsv(filePath) {
	return new Promise((resolve, reject) => {
		const data = [];
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (row) => {
				if (row['Job_URL'] && row['description']) {
					data.push({
						url: row['Job_URL'] || 'n/a',
						description: row['description'] || 'n/a',
					});
				}
			})
			.on('end', () => {
				console.log(`${data.length} entries read from CSV`);
				resolve(data);
			})
			.on('error', (error) => {
				reject(error);
			});
	});
}

module.exports = {readUrlsFromCsv};
