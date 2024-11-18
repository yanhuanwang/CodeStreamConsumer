from flask import Flask, jsonify, render_template
from pymongo import MongoClient
from bson import ObjectId
import os
import time

app = Flask(__name__)
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://dbstorage:27017/'))  # Uses environment variable or defaults to localhost
db = client['cloneDetector']

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

    # Persist counts to historical data collection
    result = db['historical_counts'].insert_one(counts)
    counts['_id'] = str(result.inserted_id)  # Convert ObjectId to string

    return jsonify(counts)

@app.route('/historical-data')
def historical():
    historical_data = list(db['historical_counts'].find({}, {"_id": 1, "timestamp": 1, "files": 1, "chunks": 1, "candidates": 1, "clones": 1}))
    for record in historical_data:
        if '_id' in record:
            record['_id'] = str(record['_id'])  # Convert ObjectId to string

    return jsonify(historical_data)

@app.route('/health')
def health():
    return "ok", 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')

