from flask import Flask, jsonify, render_template
from pymongo import MongoClient
import time

app = Flask(__name__)
client = MongoClient('mongodb://localhost:27017/')  # Adjust if using Docker
db = client['cloneDetector']

# Initialize historical data storage
historical_data = {
    'timestamps': [],
    'files': [],
    'chunks': [],
    'candidates': [],
    'clones': []
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data')
def data():
    current_time = time.strftime("%Y-%m-%d %H:%M:%S")
    counts = {
        'timestamp': current_time,
        'files': db['files'].count_documents({}),
        'chunks': db['chunks'].count_documents({}),
        'candidates': db['candidates'].count_documents({}),
        'clones': db['clones'].count_documents({})
    }

    # Append counts to historical data
    historical_data['timestamps'].append(current_time)
    historical_data['files'].append(counts['files'])
    historical_data['chunks'].append(counts['chunks'])
    historical_data['candidates'].append(counts['candidates'])
    historical_data['clones'].append(counts['clones'])

    return jsonify(counts)

@app.route('/historical-data')
def historical():
    return jsonify(historical_data)

if __name__ == '__main__':
    app.run(debug=True)