import time
import matplotlib.pyplot as plt
from pymongo import MongoClient

DB_NAME = 'cloneDetector'
COLLECTIONS = ['files', 'chunks', 'candidates', 'clones']
counts_history = {collection: [] for collection in COLLECTIONS}
timestamps = []

def main():
    client = MongoClient('mongodb://localhost:27017/')  # Adjust if using Docker
    db = client[DB_NAME]

    try:
        while True:
            current_counts = monitor_counts(db)
            counts_history[current_counts['timestamp']] = current_counts

            # Add timestamp for X-axis
            timestamps.append(current_counts['timestamp'])
            if len(timestamps) > 10:  # Limit history for visualization
                timestamps.pop(0)

            # Visualize data
            visualize_data(counts_history, timestamps)

            time.sleep(10)  # Adjust as necessary

    except KeyboardInterrupt:
        print("Monitoring stopped.")

    finally:
        client.close()

def monitor_counts(db):
    counts = {'timestamp': time.strftime("%Y-%m-%d %H:%M:%S")}
    for collection in COLLECTIONS:
        count = db[collection].count_documents({})
        counts[collection] = count
    print(counts)
    return counts

def visualize_data(counts_history, timestamps):
    plt.clf()  # Clear the current figure
    for collection in COLLECTIONS:
        plt.plot(timestamps, [counts_history[t][collection] for t in timestamps], label=collection)

    plt.xlabel('Time')
    plt.ylabel('Counts')
    plt.title('Document Counts Over Time')
    plt.xticks(rotation=45)
    plt.legend()
    plt.tight_layout()
    plt.pause(0.1)  # Pause to update the plot

if __name__ == "__main__":
    plt.ion()  # Turn on interactive mode
    main()