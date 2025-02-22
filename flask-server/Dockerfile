# Use an official Python runtime as a parent image
FROM python:3.10

# Set the working directory in the container
WORKDIR /app

# Copy project files into the container
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the API port
EXPOSE 7860

# Command to run the Flask app
CMD ["python", "app.py"]
curl -X POST "https://jeganz-yolo-flask-api.hf.space/predict" -F "file=@C:\\Users\\jegan\\Downloads\\pothole-in-road.jpg"
