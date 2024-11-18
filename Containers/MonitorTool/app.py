from flask import Flask, jsonify, render_template
from pymongo import MongoClient
import os
import time
import subprocess
import numpy as np
import matplotlib.pyplot as plt
import threading
from bson import ObjectId

app = Flask(__name__)
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://dbstorage:27017/'))  # Uses environment variable or defaults to localhost
db = client['cloneDetector']

# Ensure static and templates directories exist
os.makedirs('/app/static', exist_ok=True)
os.makedirs('/app/templates', exist_ok=True)

# Create a placeholder visualization.html if it doesn't exist
visualization_template_path = '/app/templates/visualization.html'
if not os.path.exists(visualization_template_path):
    with open(visualization_template_path, 'w') as f:
        f.write("""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Visualization</title>
        </head>
        <body>
            <h1>Trend Visualization</h1>
            {% for image in images %}
                <div>
                    <h2>{{ image.title }}</h2>
                    <img src="{{ url_for('static', filename=image.filename) }}" alt="{{ image.title }}">
                </div>
            {% endfor %}
        </body>
        </html>
        """)

# Initialize data for trend visualization
historical_times = []
files_data = []
chunks_data = []
candidates_data = []
clones_data = []
clones_size_data = []
chunks_per_file_data = []
time_to_generate_chunks = []
time_to_generate_candidates = []
time_to_expand_candidates = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data')
def data():
    current_time = time.strftime("%Y-%m-%d %H:%M:%S")
    start_time = time.time()
    chunk_start = time.time()
    chunks_count = db['chunks'].count_documents({})
    time_to_generate_chunks.append(time.time() - chunk_start)

    candidate_start = time.time()
    candidates_count = db['candidates'].count_documents({})
    time_to_generate_candidates.append(time.time() - candidate_start)

    clone_expand_start = time.time()
    clones_count = db['clones'].count_documents({})
    time_to_expand_candidates.append(time.time() - clone_expand_start)

    counts = {
        'timestamp': current_time,
        'files': db['files'].count_documents({}),
        'chunks': chunks_count,
        'candidates': candidates_count,
        'clones': clones_count,
        'clones_size': db['clones'].aggregate([{"$group": {"_id": None, "total_size": {"$sum": "$size"}}}]).next().get('total_size', 0) if clones_count > 0 else 0,
        'chunks_per_file': chunks_count / db['files'].count_documents({}) if db['files'].count_documents({}) > 0 else 0
    }
    processing_time = time.time() - start_time

    # Persist counts to historical data collection
    result = db['historical_counts'].insert_one(counts)
    counts['_id'] = str(result.inserted_id)  # Convert ObjectId to string

    # Record historical data for visualization
    historical_times.append(processing_time)
    files_data.append(counts['files'])
    chunks_data.append(counts['chunks'])
    candidates_data.append(counts['candidates'])
    clones_data.append(counts['clones'])
    clones_size_data.append(counts['clones_size'])
    chunks_per_file_data.append(counts['chunks_per_file'])

    return jsonify(counts)

@app.route('/historical-data')
def historical():
    historical_data = list(db['historical_counts'].find({}, {"_id": 1, "timestamp": 1, "files": 1, "chunks": 1, "candidates": 1, "clones": 1, "clones_size": 1, "chunks_per_file": 1}))
    for record in historical_data:
        if '_id' in record:
            record['_id'] = str(record['_id'])  # Convert ObjectId to string

    return jsonify(historical_data)

@app.route('/health')
def health():
    return "ok", 200

@app.route('/system-info')
def system_info():
    curl_version = subprocess.getoutput('curl --version')
    ps_output = subprocess.getoutput('ps')
    return jsonify({
        'curl_version': curl_version,
        'ps_output': ps_output
    })

@app.route('/visualize')
def visualize():
    metrics = [
        ('files_vs_time.png', files_data, 'Files vs Processing Time'),
        ('chunks_vs_time.png', chunks_data, 'Chunks vs Processing Time'),
        ('candidates_vs_time.png', candidates_data, 'Candidates vs Processing Time'),
        ('clones_vs_time.png', clones_data, 'Clones vs Processing Time'),
        ('clones_size_vs_time.png', clones_size_data, 'Clones Size vs Processing Time'),
        ('chunks_per_file_vs_time.png', chunks_per_file_data, 'Chunks per File vs Processing Time'),
        ('time_to_generate_chunks.png', time_to_generate_chunks, 'Time to Generate Chunks'),
        ('time_to_generate_candidates.png', time_to_generate_candidates, 'Time to Generate Clone Candidates'),
        ('time_to_expand_candidates.png', time_to_expand_candidates, 'Time to Expand Clone Candidates')
    ]

    for filename, data, title in metrics:
        plt.figure(figsize=(10, 6))
        plt.plot(data, label=title)
        plt.xlabel('Time Interval')
        plt.ylabel('Metric Value')
        plt.title(title)
        plt.legend()
        plt.grid(True)
        plt.savefig(f'/app/static/{filename}')
        plt.close()

    images = [{'filename': filename, 'title': title} for filename, _, title in metrics]
    return render_template('visualization.html', images=images)

# Background thread to regularly sample data
def monitor_data():
    with app.app_context():
        while True:
            time.sleep(60)  # Sample every 60 seconds
            data()

# Start the monitoring thread
monitoring_thread = threading.Thread(target=monitor_data, daemon=True)
monitoring_thread.start()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
