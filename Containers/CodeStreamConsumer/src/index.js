const express = require('express');
const formidable = require('formidable');
const fs = require('fs/promises');
const app = express();
const PORT = 3000;

const Timer = require('./Timer');
const CloneDetector = require('./CloneDetector');
const CloneStorage = require('./CloneStorage');
const FileStorage = require('./FileStorage');


// Express and Formidable stuff to receice a file for further processing
// --------------------
const form = formidable({multiples:false});

app.post('/', fileReceiver );
function fileReceiver(req, res, next) {
    form.parse(req, (err, fields, files) => {
        fs.readFile(files.data.filepath, { encoding: 'utf8' })
            .then( data => { return processFile(fields.name, data); });
    });
    return res.end('');
}

app.get('/', viewClones );

const server = app.listen(PORT, () => { console.log('Listening for files on port', PORT); });


// Page generation for viewing current progress
// --------------------
function getStatistics() {
    let cloneStore = CloneStorage.getInstance();
    let fileStore = FileStorage.getInstance();
    let output = 'Processed ' + fileStore.numberOfFiles + ' files containing ' + cloneStore.numberOfClones + ' clones.'
    return output;
}

function lastFileTimersHTML() {
    if (!lastFile) return '';
    output = '<p>Timers for last file processed:</p>\n<ul>\n'
    let timers = Timer.getTimers(lastFile);
    for (t in timers) {
        output += '<li>' + t + ': ' + (timers[t] / (1000n)) + ' µs\n'
    }
    output += '</ul>\n';
    return output;
}

function listClonesHTML() {
    let cloneStore = CloneStorage.getInstance();
    let output = '';

    cloneStore.clones.forEach( clone => {
        if (!clone || !clone.name) {
            console.error('Missing clone name:', clone);
            return;
        }
        output += '<hr>\n';
        output += '<h2>Source File: ' + clone.sourceName + '</h2>\n';
        output += '<p>Starting at line: ' + clone.sourceStart + ' , ending at line: ' + clone.sourceEnd + '</p>\n';
        output += '<ul>';
        clone.targets.forEach( target => {
            output += '<li>Found in ' + target.name + ' starting at line ' + target.startLine + '\n';
        });
        output += '</ul>\n'
        output += '<h3>Contents:</h3>\n<pre><code>\n';
        output += clone.originalCode;
        output += '</code></pre>\n';
    });

    return output;
}

function listProcessedFilesHTML() {
    let fs = FileStorage.getInstance();
    let output = '<HR>\n<H2>Processed Files</H2>\n'
    output += fs.filenames.reduce( (out, name) => {
        out += '<li>' + name + '\n';
        return out;
    }, '<ul>\n');
    output += '</ul>\n';
    return output;
}

function viewClones(req, res, next) {
    let page='<HTML><HEAD><TITLE>CodeStream Clone Detector</TITLE></HEAD>\n';
    page += '<BODY><H1>CodeStream Clone Detector</H1>\n';
    page += '<P>' + getStatistics() + '</P>\n';
    page += lastFileTimersHTML() + '\n';
    page += listClonesHTML() + '\n';
    page += listProcessedFilesHTML() + '\n';
    page += '</BODY></HTML>';
    res.send(page);
}

// Some helper functions
// --------------------
// PASS is used to insert functions in a Promise stream and pass on all input parameters untouched.
PASS = fn => d => {
    try {
        fn(d);
        return d;
    } catch (e) {
        throw e;
    }
};

const STATS_FREQ = 100;
const URL = process.env.URL || 'http://localhost:8080/';
var lastFile = null;
let fileTimers = []; // Stores timers for each file

function maybePrintStatistics(file, cloneDetector, cloneStore) {
    let timers = Timer.getTimers(file);
    fileTimers.push(timers); // Store timers for every file

    if (0 == cloneDetector.numberOfProcessedFiles % STATS_FREQ) {
        console.log('Processed', cloneDetector.numberOfProcessedFiles, 'files and found', cloneStore.numberOfClones, 'clones.');
        let timers = Timer.getTimers(file);
        let str = 'Timers for last file processed: ';
        for (t in timers) {
            str += t + ': ' + (timers[t] / (1000n)) + ' µs '
        }
        console.log(str);
        console.log('List of found clones available at', URL);
    }

    if (fileTimers.length % BATCH_SIZE === 0) {
        let lastBatch = fileTimers.slice(-BATCH_SIZE);
        let avgTimers = getAverageTimers(lastBatch);

        // Store the average of this batch
        batchAverages.push({
            batch: batchAverages.length + 1,
            avgTimers: avgTimers
        });

        console.log(`Average times for batch ${batchAverages.length}:`, avgTimers);
    }

    return file;
}

// Processing of the file
// --------------------
function processFile(filename, contents) {
    let cd = new CloneDetector();
    let cloneStore = CloneStorage.getInstance();

    return Promise.resolve({name: filename, contents: contents} )
        //.then( PASS( (file) => console.log('Processing file:', file.name) ))
        .then( (file) => Timer.startTimer(file, 'total') )
        .then( (file) => cd.preprocess(file) )
        .then( (file) => cd.transform(file) )

        .then( (file) => Timer.startTimer(file, 'match') )
        .then( (file) => cd.matchDetect(file) )
        .then( (file) => cloneStore.storeClones(file) )
        .then( (file) => Timer.endTimer(file, 'match') )

        .then( (file) => cd.storeFile(file) )
        .then( (file) => Timer.endTimer(file, 'total') )
        .then( PASS( (file) => lastFile = file ))
        .then( PASS( (file) => maybePrintStatistics(file, cd, cloneStore) ))
    // TODO Store the timers from every file (or every 10th file), create a new landing page /timers
    // and display more in depth statistics there. Examples include:
    // average times per file, average times per last 100 files, last 1000 files.
    // Perhaps throw in a graph over all files.
        .catch( console.log );
};

/*
1. Preprocessing: Remove uninteresting code, determine source and comparison units/granularities
2. Transformation: One or more extraction and/or transformation techniques are applied to the preprocessed code to obtain an intermediate representation of the code.
3. Match Detection: Transformed units (and/or metrics for those units) are compared to find similar source units.
4. Formatting: Locations of identified clones in the transformed units are mapped to the original code base by file location and line number.
5. Post-Processing and Filtering: Visualisation of clones and manual analysis to filter out false positives
6. Aggregation: Clone pairs are aggregated to form clone classes or families, in order to reduce the amount of data and facilitate analysis.
*/
app.get('/timers', viewTimers);
function getAverageTimers(files) {
    let total = files.reduce((acc, timers) => {
        for (let key in timers) {
            acc[key] = (acc[key] || 0n) + timers[key];
        }
        return acc;
    }, {});

    let avg = {};
    let count = BigInt(files.length);
    for (let key in total) {
        avg[key] = total[key] / count;
    }

    return avg;
}

function viewTimers(req, res, next) {
    let totalFiles = fileTimers.length;
    let totalTimes = fileTimers.reduce((acc, timers) => {
        for (let key in timers) {
            acc[key] = (acc[key] || 0n) + timers[key];
        }
        return acc;
    }, {});

    let avgTimes = {};
    for (let key in totalTimes) {
        avgTimes[key] = totalTimes[key] / BigInt(totalFiles);
    }

    // Display timers
    let page = '<HTML><HEAD><TITLE>Timers Statistics</TITLE></HEAD>\n';
    page += '<BODY><H1>Timers Statistics</H1>\n';
    page += '<P>Total Files Processed: ' + totalFiles + '</P>\n';
    page += '<H2>Average Times per File</H2>\n';
    page += '<ul>';
    for (let key in avgTimes) {
        page += `<li>${key}: ${avgTimes[key] / 1000n} µs</li>\n`;
    }
    page += '</ul>\n';

    // Optionally, we could add more detailed stats for last 100 or 1000 files
    res.send(page + '</BODY></HTML>');
}
const BATCH_SIZE = 100;
let batchAverages = []; // Store average times for each batch of 100 files
// Helper function to convert BigInt to regular Number (or String if you prefer)
function convertBigIntToNumber(obj) {
    if (typeof obj === 'bigint') {
        return Number(obj); // Or you could return obj.toString() if you want to keep full precision
    } else if (Array.isArray(obj)) {
        return obj.map(convertBigIntToNumber);
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, convertBigIntToNumber(value)])
        );
    } else {
        return obj;
    }
}

// Timers endpoint
app.get('/timers-each', (req, res) => {
    const convertedData = batchAverages.map(batch => ({
        ...batch,
        avgTimers: convertBigIntToNumber(batch.avgTimers)
    }));

    res.json(convertedData); // Send the converted data as JSON
});

app.get('/timers-trend', (req, res) => {
    let page = `
        <html>
            <head>
                <title>Clone Detection - Timer Trends</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            </head>
            <body>
                <h1>Timer Trends</h1>
                <canvas id="timersChart" width="400" height="200"></canvas>
                <script>
                    fetch('/timers-each')
                        .then(response => response.json())
                        .then(data => {
                            const labels = data.map(batch => 'Batch ' + batch.batch);
                            const matchTimes = data.map(batch => Number(batch.avgTimers.match) / 1000); // convert nanoseconds to microseconds
                            const totalTimes = data.map(batch => Number(batch.avgTimers.total) / 1000); // convert nanoseconds to microseconds

                            const ctx = document.getElementById('timersChart').getContext('2d');
                            const timersChart = new Chart(ctx, {
                                type: 'line',
                                data: {
                                    labels: labels,
                                    datasets: [
                                        {
                                            label: 'Match Time (µs)',
                                            data: matchTimes,
                                            borderColor: 'rgba(75, 192, 192, 1)',
                                            borderWidth: 1,
                                            fill: false
                                        },
                                        {
                                            label: 'Total Time (µs)',
                                            data: totalTimes,
                                            borderColor: 'rgba(153, 102, 255, 1)',
                                            borderWidth: 1,
                                            fill: false
                                        }
                                    ]
                                },
                                options: {
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            title: {
                                                display: true,
                                                text: 'Time (µs)'
                                            }
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                text: 'Batch'
                                            }
                                        }
                                    }
                                }
                            });
                        })
                        .catch(error => console.error('Error fetching timers data:', error));
                </script>
            </body>
        </html>
    `;

    res.send(page);
});
