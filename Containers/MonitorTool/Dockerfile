FROM python:3.9-slim

WORKDIR /app
COPY . .

# Install required packages including curl, ps utilities, and matplotlib dependencies
RUN apt-get update && apt-get install -y \
    curl \
    procps \
    libatlas-base-dev \
    gfortran \
    && rm -rf /var/lib/apt/lists/*

RUN pip install Flask pymongo matplotlib numpy

CMD ["python", "app.py"]
