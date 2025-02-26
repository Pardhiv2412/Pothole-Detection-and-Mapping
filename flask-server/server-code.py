import os
# Redirect Torch Hub cache directory to a writable location
os.environ["TORCH_HOME"] = "/tmp/torch"

from flask import Flask, request, jsonify,render_template
import numpy as np
import cv2
import torch
from flask_cors import CORS
from ultralytics import YOLO
import json
from datetime import datetime
import psycopg2
import uuid  # For generating unique filenames


os.environ["PYTHONUNBUFFERED"] = "1"
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

#Load MiDas model
print("Loading MiDaS model...")
midas = torch.hub.load("intel-isl/MiDaS", "DPT_Large", trust_repo=True)
midas.eval()

print("Loading MiDaS transforms...")
transform = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True).default_transform

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Ensure the folder exists

def detect_objects_with_yolo(frame):
    """Run YOLO detection on a frame."""
    try:
        results = model.predict(source=frame, conf=0.3, show=False)
        return results[0] if results else None
    except Exception:
        return None

def calculate_pothole_severity(d_max, d_min, area, avg_depth, max_area=80000):
        """Calculates severity score (1 to 5) for an individual pothole."""
        D = (d_max - d_min) / (60 - 10) 
        A = area / max_area  
        M = (avg_depth - 10) / (60 - 10) 

        S = 3.0 * D + 2.0 * A + 1.0 * M  
        S_min, S_max = 0, 6.0
        S_final = 1 + 4 * (S - S_min) / (S_max - S_min)

        return max(1, min(5, S_final))


def calculate_frame_severity(pothole_severities, num_potholes, max_potholes=5):
        """Computes the severity score for the entire frame using pothole severities & count."""
        if not pothole_severities:
            return 1  

        avg_pothole_severity = sum(pothole_severities) / len(pothole_severities)
        pothole_count_factor = min(1.0, num_potholes / max_potholes)  

        W1, W2 = 2.0, 3.0  # Weights for severity and pothole count
        frame_severity = (W1 * avg_pothole_severity + W2 * (pothole_count_factor * 5)) / (W1 + W2)

        return max(1, min(5, frame_severity))  

    
def estimate_depth(region):
    img_rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
    input_batch = transform(img_rgb).to(torch.device("cpu"))
    with torch.no_grad():
        prediction = midas(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=region.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()
    depth_map = prediction.cpu().numpy()
    d_max, d_min = depth_map.max(), depth_map.min()
    avg_depth = depth_map.mean()
    area = region.shape[0] * region.shape[1]
    pothole_severity = calculate_pothole_severity(d_max, d_min, area, avg_depth)
    return pothole_severity
    
def insert_or_update_location_in_db(latitude, longitude, severity):
    if latitude is None or longitude is None:
        return
    try:
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()
        
        # Check if the location already exists
        cursor.execute('''SELECT severity FROM potholes WHERE latitude = %s AND longitude = %s''', (latitude, longitude))

        if cursor.fetchone():
            # Update severity if location already exists
            cursor.execute('''UPDATE potholes SET severity = %s WHERE latitude = %s AND longitude = %s''', (severity, latitude, longitude))
            
        else:
            # Insert new record if location is not in DB
            cursor.execute('''INSERT INTO potholes (latitude, longitude, severity) VALUES (%s, %s, %s)''', (latitude, longitude, severity))
        
        conn.commit()
        
    except Exception as e:
        print(f"Error inserting or updating DB: {e}")
        
    finally:
        if conn:
            cursor.close()
            conn.close()


def delete_location_from_db(latitude, longitude):
    try:
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()
        
        # Check if the location exists before deleting
        cursor.execute('''SELECT * FROM potholes WHERE latitude = %s AND longitude = %s''', (latitude, longitude))
        if cursor.fetchone() is None:
            print(f"Location ({latitude}, {longitude}) not found in DB. No deletion needed.")
            return
        
        cursor.execute('''DELETE FROM potholes WHERE latitude = %s AND longitude = %s''', (latitude, longitude))
        conn.commit()
        print(f"Deleted location ({latitude}, {longitude}) from DB.")
    
    except Exception as e:
        print(f"Error deleting from DB: {e}")
    
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/upload', methods=['POST'])
def process_video():
    try:
        print("Processing video...", flush=True)
        file = request.files.get("file")
        if not file:
            print('No file uploaded.', flush=True)
            return jsonify({'message': 'No file uploaded.'}), 400
        
        filename = f"{uuid.uuid4()}.mp4"
        print("File name ondakki uuid oke vach", flush=True)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        print("save cheyyan pova", flush=True)
        file.save(filepath)
        print("save cheyth success", flush=True)
        print(f'Ithaan makale request {request.form}')
        print('Start location and end location medikan pova', flush=True)
        start_loc = request.form.get("startLocation")
        end_loc = request.form.get("endLocation")
        print(f'Start location: {start_loc}', flush=True)
        print(f'End location: {end_loc}', flush=True)
        try:
            start_location = json.loads(start_loc) if start_loc else None
            end_location = json.loads(end_loc) if end_loc else None
            print('Start location: ',start_location, flush=True)
            print('End location: ',end_location, flush=True)
        except Exception as e:
            print("Location json eval cheythappo umfi: ",str(e), flush=True)
            start_location, end_location = None, None
        
        cap = cv2.VideoCapture(filepath)
        if not cap.isOpened():
            print('Failed to open video file', flush=True)
            return jsonify({'message': 'Failed to open video file'}), 400

        print("Cap oke open aan...polik", flush=True)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print("Number of frames in video: ", total_frames, flush=True)
        # Read first frame
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        success_first, first_frame = cap.read()
        
        # Read last frame
        cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames - 1)
        success_last, last_frame = cap.read()
        
        cap.release()
        os.remove(filepath)
        print("First and Last frame process cheyan pova", flush=True)
        print(f'Success first {success_first} :: Sucess Last {success_last}')
        if success_first and start_location:
            print("First frame process cheyan pova", flush=True)
            result = detect_objects_with_yolo(first_frame)
            if result is None or len(result.boxes) == 0:
                print("Delete DB cheyyan pone aan (first frame)", flush=True)
                delete_location_from_db(start_location['coords']['latitude'], start_location['coords']['longitude'])

            else:
                pothole_severities = []
                num_potholes = len(result.boxes)
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    x1, y1 = max(0, x1 - 30), max(0, y1 - 30)
                    x2, y2 = min(first_frame.shape[1], x2 + 30), min(first_frame.shape[0], y2 + 30)
                    region = first_frame[y1:y2, x1:x2]
                    
                    if region.size > 0:
                        pothole_severity = estimate_depth(region)
                        pothole_severities.append(pothole_severity)
                
                frame_severity = calculate_frame_severity(pothole_severities, num_potholes)
                severity_score = int(np.round(frame_severity))
                print("Insert DB cheyyan pone aan (first frame)", flush=True)
                insert_or_update_location_in_db(start_location['coords']['latitude'], start_location['coords']['longitude'], severity_score)
        
        if success_last and end_location:
            print("Last frame process cheyan pova", flush=True)
            result = detect_objects_with_yolo(last_frame)
            if result is None or len(result.boxes) == 0:
                print("Delete DB cheyyan pone aan (last frame)", flush=True)
                delete_location_from_db(end_location['coords']['latitude'], end_location['coords']['longitude'])

            else:
                pothole_severities = []
                num_potholes = len(result.boxes)
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    x1, y1 = max(0, x1 - 30), max(0, y1 - 30)
                    x2, y2 = min(last_frame.shape[1], x2 + 30), min(last_frame.shape[0], y2 + 30)
                    region = last_frame[y1:y2, x1:x2]
                    
                    if region.size > 0:
                        pothole_severity = estimate_depth(region)
                        pothole_severities.append(pothole_severity)
                
                frame_severity = calculate_frame_severity(pothole_severities, num_potholes)
                severity_score = int(np.round(frame_severity))
                print("Insert DB cheyyan pone aan (last frame)", flush=True)
                insert_or_update_location_in_db(end_location['coords']['latitude'], end_location['coords']['longitude'], severity_score)


        print("Video processed successfully", flush=True)
        return jsonify({'message': 'Video processed successfully'}), 200
        
    except Exception as e:
        print("An error occurred: ", str(e), flush=True)
        return jsonify({'message': 'An error occurred', 'error': str(e)}), 500


@app.route('/', methods=['GET'])
def hello_world():
    return "Welcome to our pothole detector"


@app.route('/potholes', methods=['GET'])
def get_potholes():
    """Fetch all potholes from the database"""
    print("Vili vann", flush=True)
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
        cursor.close()
        conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860, debug=False)