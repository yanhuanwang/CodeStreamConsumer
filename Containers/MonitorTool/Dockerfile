FROM python:3.9-slim

WORKDIR /app
COPY . .

RUN pip install pymongo
RUN pip install Flask pymongo

CMD ["python", "monitor_tool.py"]
