from ultralytics import YOLO
import cv2
import numpy as np
import torch

# Load the model
model = YOLO('C:/Users/pardh/Downloads/best.pt')

# Open the video file
video_path = 'Pothole Video.mp4'  
cap = cv2.VideoCapture(video_path)

# Get video properties
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = int(cap.get(cv2.CAP_PROP_FPS))

# Create video writer
out = cv2.VideoWriter('output2.mp4', cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    # Run YOLOv8 tracking on the frame
    results = model.predict(source=frame, conf=0.5, show=False)

    # Get the first result (since we only have one image)
    result = results[0]

    # Process detections
    if len(result.boxes) > 0:  # If there are detections
        for box in result.boxes:
            # Get box coordinates
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()  # Convert to numpy array
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

            # Get confidence score
            conf = float(box.conf[0].cpu().numpy())

            # Get class name
            cls = int(box.cls[0].cpu().numpy())
            class_name = model.names[cls]

            # Calculate center point
            center_x = (x1 + x2) // 2
            center_y = (y1 + y2) // 2

            # Calculate width and height of box
            box_width = x2 - x1
            box_height = y2 - y1

            # Print information for each detection
            print(f"Detection:")
            print(f"- Class: {class_name}")
            print(f"- Confidence: {conf:.2f}")
            print(f"- Coordinates: ({x1}, {y1}), ({x2}, {y2})")
            print(f"- Center: ({center_x}, {center_y})")
            print(f"- Size: {box_width}x{box_height}")
            print("-------------------")

            # Draw on frame
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.circle(frame, (center_x, center_y), 5, (0, 255, 0), -1)

            # Add label
            label = f"{class_name}: {conf:.2f}"
            cv2.putText(frame, label, (x1, y1 - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            # Add size
            size_label = f"{box_width}x{box_height}"
            cv2.putText(frame, size_label, (x1, y2 + 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    # Write the frame to output video
    out.write(frame)

# Release everything
cap.release()
out.release()
print("Video saved as output.mp4")
