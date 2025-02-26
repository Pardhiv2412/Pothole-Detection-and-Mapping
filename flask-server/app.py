from flask import Flask, request, jsonify,render_template
import numpy as np
import cv2
import os
from flask_cors import CORS
from ultralytics import YOLO
import json
from datetime import datetime
import psycopg2
import uuid  # For generating unique filenames

app = Flask(__name__)
CORS(app)

# Database credentials
db_config = {
    "host": "dpg-cupn225svqrc73f3nk1g-a.singapore-postgres.render.com",
    "database": "pothole_db_jufk",
    "user": "pothole_db_user",
    "password": "FrASueUsUotopruwjaWrDHCR0V4Q921h",
    "port": 5432,  # Default PostgreSQL port
}


# Load YOLO model
model = YOLO('best.pt')  # Replace with your actual model

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Ensure the folder exists

def convert_iso_to_epoch(iso_string):
    """Convert ISO timestamp to epoch time."""
    try:
        # If it's already a number (epoch time in ms), convert to seconds
        if isinstance(iso_string, (int, float)):
            return iso_string / 1000  # Convert milliseconds to seconds

        # Handle ISO format string (if any)
        dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return None  # Return None if conversion fails

def detect_objects_with_yolo(frame):
    """Run YOLO detection on a frame."""
    try:
        results = model.predict(source=frame, conf=0.3, show=False)
        return results[0] if results else None
    except Exception:
        return None

def find_nearest_location(frame_time, locations_data):
    """Find the nearest GPS location for the frame timestamp."""
    if not locations_data:
        return None
    
    nearest_location = None
    min_time_diff = float('inf')

    for location in locations_data:
        location_time = location.get('timestamp')
        if location_time is None:
            continue
        
        time_diff = abs(frame_time - location_time)
        if time_diff < min_time_diff:
            min_time_diff = time_diff
            nearest_location = location

    return nearest_location

def insert_location_into_db(latitude, longitude):
    """Insert pothole location into the database if not exists."""
    if latitude is None or longitude is None:
        return
    
    try:
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute('''SELECT * FROM potholes WHERE latitude = %s AND longitude = %s''', (latitude, longitude))
        print('inside insert_location_into_db')
        if cursor.fetchone() is None:
            cursor.execute('''INSERT INTO potholes (latitude, longitude, severity) VALUES (%s, %s, 4)''', (latitude, longitude))
            conn.commit()
        else:
            print('Pothole already exists in the database')
    except Exception:
        pass
    finally:
        if conn:
            cursor.close()
            conn.close()

@app.route('/upload', methods=['POST'])
def process_video():
    try:
        file = request.files.get('file')
        if not file:
            return jsonify({'message': 'No file uploaded.'}), 400
        
        # Generate a unique filename
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.mp4"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        # Save file to disk
        file.save(filepath)

        # Read locations and timestamps
        locations = request.form.get('locations', '[]')
        try:
            locations_data = json.loads(locations)
            for location in locations_data:
                location['timestamp'] = convert_iso_to_epoch(location.get('timestamp', ''))
        except Exception:
            locations_data = []
        
        # locations_filename = f"{file_id}.json"
        # locations_path = os.path.join(UPLOAD_FOLDER, locations_filename)
        
        # with open(locations_path, "w") as json_file:
        #     json.dump(locations_data, json_file, indent=4)

        start_time_str = request.form.get('start_time', '')
        start_time = convert_iso_to_epoch(start_time_str) or 0

        # Open saved video with OpenCV
        cap = cv2.VideoCapture(filepath)

        if not cap.isOpened():
            return jsonify({'message': 'Failed to open video file'}), 400

        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
        frame_count = 0
        frame_interval = int(fps / 3)  # Process only 2 frames per second

        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break
            
            # Process only every Nth frame
            if frame_count % frame_interval == 0:
                frame_time = frame_count / fps + start_time
                
                # result = None  # Skip detection for now
                result = detect_objects_with_yolo(frame)

                if result and len(result.boxes) > 0:
                    for box in result.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                        conf = float(box.conf[0].cpu().numpy())
                        cls = int(box.cls[0].cpu().numpy())
                        class_name = model.names[cls]
                if len(result.boxes) > 0:
                    print('kuzhii ondee')
                    nearest_location = find_nearest_location(frame_time, locations_data)
                    print('location ondee : ',nearest_location)
                    if nearest_location:
                        insert_location_into_db(nearest_location['coords']['latitude'], nearest_location['coords']['longitude'])
            frame_count += 1  # Always increment the frame count


        cap.release()
        os.remove(filepath)  # Delete the saved file after processing

        return jsonify({'message': 'Video processed successfully'}), 200

    except Exception as e:
        print(e)
        return jsonify({'message': 'An error occurred', 'error': str(e)}), 500

@app.route('/', methods=['GET'])
def hello_world():
    files = os.listdir(UPLOAD_FOLDER)
    return render_template('index.html', files=files)

@app.route('/potholes', methods=['GET'])
def get_potholes():
    """Fetch all potholes from the database"""
    try:
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()

        cursor.execute("SELECT id, longitude, latitude, severity, timestamp FROM potholes;")
        data = cursor.fetchall()

        # Convert data into JSON format
        potholes = [
            {
                "id": row[0],
                "longitude": row[1],
                "latitude": row[2],
                "severity": row[3],
                "timestamp": row[4].isoformat()  # Convert timestamp to string
            }
            for row in data
        ]

        return jsonify(potholes)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
