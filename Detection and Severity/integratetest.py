import torch
import cv2
import numpy as np
import os
import time
from ultralytics import YOLO

def setup_device():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    if device.type == 'cpu':
        raise RuntimeError("GPU is required but not available.")
    return device

class PotholeDepthDetector:
    def __init__(self, yolo_weights, conf_threshold=0.5):
        self.device = setup_device()
        self.yolo_model = YOLO(yolo_weights)
        self.conf_threshold = conf_threshold
        
        print("Loading MiDaS model...")
        self.midas = torch.hub.load("intel-isl/MiDaS", "DPT_Large", trust_repo=True).to(self.device)
        self.midas.eval()
        
        print("Loading MiDaS transforms...")
        self.transform = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True).default_transform

    def calculate_pothole_severity(self, d_max, d_min, area, avg_depth, max_area=80000):
        """Calculates severity score (1 to 5) for an individual pothole."""
        D = (d_max - d_min) / (60 - 10)  # Normalized depth severity
        A = area / max_area  # Normalized pothole area
        M = (avg_depth - 10) / (60 - 10)  # Normalized avg depth severity

        # Weighted sum
        S = 3.0 * D + 2.0 * A + 1.0 * M  

        # Normalize to range [1, 5]
        S_min, S_max = 0, 6.0
        S_final = 1 + 4 * (S - S_min) / (S_max - S_min)

        return max(1, min(5, S_final))  # Clamp between 1 and 5

    def calculate_frame_severity(self, pothole_severities, num_potholes, max_potholes=5):
        """Computes the severity score for the entire frame using pothole severities & count."""
        if not pothole_severities:
            return 1  # No potholes → minimal severity

        avg_pothole_severity = sum(pothole_severities) / len(pothole_severities)
        pothole_count_factor = min(1.0, num_potholes / max_potholes)  # Normalize to [0, 1]

        # Weighted sum for frame severity
        W1, W2 = 2.0, 3.0  # Weights for severity and pothole count
        frame_severity = (W1 * avg_pothole_severity + W2 * (pothole_count_factor * 5)) / (W1 + W2)

        return max(1, min(5, frame_severity))  # Clamp between 1 and 5

    def estimate_depth(self, img):
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        input_batch = self.transform(img_rgb).to(self.device)
        
        with torch.no_grad():
            prediction = self.midas(input_batch)
            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=img.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()
            
        depth_map = prediction.cpu().numpy()
        d_max = depth_map.max()
        d_min = depth_map.min()
        (l, b) = depth_map.shape
        avg_depth = depth_map.mean()

        pothole_severity = self.calculate_pothole_severity(d_max, d_min, l * b, avg_depth)

        print(f"Pothole Severity Score = {pothole_severity}")

        depth_map = cv2.normalize(depth_map, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        return depth_map, pothole_severity
        
    def process_video(self, input_video, output_video, frame_skip=1):
        if not os.path.exists(input_video):
            print(f"Error: Input video not found: {input_video}")
            return
        
        cap = cv2.VideoCapture(input_video)
        if not cap.isOpened():
            print(f"Error: Could not open video: {input_video}")
            return
        
        width, height, fps = int(cap.get(3)), int(cap.get(4)), int(cap.get(5))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        video_duration = total_frames / fps
        print(f"Video duration: {video_duration:.2f} seconds")
        
        out = cv2.VideoWriter(output_video, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
        
        frame_count = 0
        start_time = time.time()
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame_count += 1
                if frame_count % frame_skip != 0:
                    continue
                
                print(f"Processing frame {frame_count}/{total_frames}")
                results = self.yolo_model(frame, device=self.device, conf=self.conf_threshold)
                boxes = results[0].boxes if results else []
                
                pothole_severities = []
                num_potholes = len(boxes)

                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    conf = float(box.conf[0].cpu().numpy())

                    # Expand region by +30 pixels on all sides
                    x1 = max(0, x1 - 30)
                    y1 = max(0, y1 - 30)
                    x2 = min(width, x2 + 30)
                    y2 = min(height, y2 + 30)

                    region = frame[y1:y2, x1:x2]
                    if region.size > 0:
                        depth_map, pothole_severity = self.estimate_depth(region)
                        pothole_severities.append(pothole_severity)

                        depth_map = cv2.resize(depth_map, (x2-x1, y2-y1))
                        depth_colored = cv2.applyColorMap(depth_map, cv2.COLORMAP_WINTER)
                        frame[y1:y2, x1:x2] = cv2.addWeighted(region, 0.4, depth_colored, 0.6, 0)

                        # Draw bounding box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(frame, f"Pothole: {conf:.2f}", (x1, y1 - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                frame_severity = self.calculate_frame_severity(pothole_severities, num_potholes)
                print(f"Frame Severity Score: {frame_severity:.2f}")

                out.write(frame)
                cv2.imshow('Pothole Detection', frame)
                torch.cuda.empty_cache()
                
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                
        except Exception as e:
            print(f"Error during video processing: {str(e)}")
        
        finally:
            cap.release()
            out.release()
            cv2.destroyAllWindows()
            print(f"Total processing time: {time.time() - start_time:.2f} seconds")


if __name__ == "__main__":
    model_path = 'newbest.pt'
    video_path = 'WhatsApp Video 2025-01-08 at 21.52.58_3240f7d3.mp4'
    output_path = 'output.mp4'
    
    if not os.path.exists(model_path):
        print(f"Error: Model file not found: {model_path}")
    elif not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}")
    else:
        detector = PotholeDepthDetector(model_path)
        detector.process_video(video_path, output_path, frame_skip=1)