FROM python:3.9-slim

WORKDIR /app
COPY . .

# Install required packages including curl and ps utilities
RUN apt-get update && apt-get install -y \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

RUN pip install Flask pymongo

CMD ["python", "app.py"]
