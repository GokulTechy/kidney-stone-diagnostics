from ultralytics import YOLO
import cv2
import numpy as np
from PIL import Image

# Load trained YOLO model
model = YOLO("models/ct_stone_yolo.pt")


def detect_ct_stone_size(image, mm_per_pixel):
    """
    Detects kidney stone from CT image using YOLO.
    Converts detected stone diameter from pixels to millimeters.

    Parameters:
        image: PIL image
        mm_per_pixel: calibration value for converting pixels to mm

    Returns:
        output_image: image with bounding box
        detections: list of detected stones with size in mm
    """

    results = model(image)

    detections = []
    output_image = np.array(image.convert("RGB"))

    for result in results:
        boxes = result.boxes

        for box in boxes:
            confidence = float(box.conf[0])

            x1, y1, x2, y2 = box.xyxy[0].tolist()

            x1 = int(x1)
            y1 = int(y1)
            x2 = int(x2)
            y2 = int(y2)

            width_px = abs(x2 - x1)
            height_px = abs(y2 - y1)

            # Stone diameter is taken as the maximum side of bounding box
            diameter_px = max(width_px, height_px)

            # Convert pixel size to millimeter size
            size_mm = round(diameter_px * mm_per_pixel, 2)

            # Draw bounding box on image
            cv2.rectangle(
                output_image,
                (x1, y1),
                (x2, y2),
                (255, 0, 0),
                2
            )

            # Show only confidence on image
            cv2.putText(
                output_image,
                f"Stone {confidence * 100:.1f}%",
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 0, 0),
                2
            )

            detections.append({
                "confidence": round(confidence * 100, 2),
                "bbox": [x1, y1, x2, y2],
                "size_mm": size_mm
            })

    output_image = Image.fromarray(output_image)

    return output_image, detections