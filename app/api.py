import os
import sys
import io
import base64
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np

# Ensure app/ path is in sys.path for safe importing
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.append(app_dir)

# Import existing ML functions
from predict import predict_kidney_stone
from risk import calculate_risk
from ct_yolo_size import detect_ct_stone_size

# Initialize FastAPI application
app = FastAPI(
    title="LithoScan AI - Kidney Stone Diagnostics API",
    description="REST API wrapping TensorFlow and YOLO models for kidney stone detection and risk scoring.",
    version="1.2"
)

# Enable CORS so the static frontend (e.g. hosted on Netlify) can query this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def is_medical_scan(pil_image: Image.Image) -> tuple[bool, str]:
    """
    Validates whether the uploaded image is a valid medical scan (ultrasound/CT).
    """
    try:
        # Convert to RGB to ensure 3 channels
        img_rgb = pil_image.convert("RGB")
        img_array = np.array(img_rgb)
        
        # Calculate mean brightness across all pixels
        mean_brightness = np.mean(img_array)
        
        # Calculate deviation from grayscale (standard deviation of R, G, B channels per pixel)
        channel_std = np.std(img_array, axis=2)
        mean_color_diff = np.mean(channel_std)
        
        # 1. Page screenshots or documents have very high brightness (white background)
        if mean_brightness > 165.0:
            return False, "High average brightness detected (e.g. document, screenshot, or white page). Please upload only a valid ultrasound or CT scan image with a dark background."
            
        # 2. General photos (like faces, animals, colorful pictures) have high color diversity
        if mean_color_diff > 25.0:
            return False, "High color saturation or color variety detected. Please upload only a valid ultrasound or CT scan image (typically grayscale/dark)."
            
        # 3. Completely plain/empty/black image
        if mean_brightness < 2.0:
            return False, "Image appears to be completely blank or black. Please upload a valid scan image."
            
        return True, ""
    except Exception as e:
        return True, ""


@app.get("/")
def read_root():
    """Health check / API Greeting."""
    return {
        "status": "online",
        "system": "LithoScan AI Clinical AI API",
        "endpoints": {
            "ultrasound": "/predict-ultrasound [POST]",
            "ct_scan": "/predict-ct [POST]"
        }
    }

@app.post("/predict-ultrasound")
async def predict_ultrasound(
    image: UploadFile = File(...),
    age: int = Form(25),
    pain_level: int = Form(5),
    fever: str = Form("No"),
    vomiting: str = Form("No"),
    blood_in_urine: str = Form("No"),
    previous_history: str = Form("No")
):
    """
    Exposes Keras/TensorFlow model prediction for ultrasound images.
    Combines diagnostic result with patient clinical symptoms to calculate risk.
    """
    # Read uploaded file as PIL Image
    contents = await image.read()
    pil_image = Image.open(io.BytesIO(contents))
    
    # Validate image
    is_valid, warning_msg = is_medical_scan(pil_image)
    
    # Run ultrasound prediction
    result, confidence = predict_kidney_stone(pil_image)
    stone_detected = (result == "Stone Detected")
    
    # Calculate Risk Score (following same logic as app.py)
    risk, reasons = calculate_risk(
        stone_detected=stone_detected,
        stone_size_mm=0,
        pain_level=pain_level,
        fever=(fever == "Yes"),
        vomiting=(vomiting == "Yes"),
        blood_in_urine=(blood_in_urine == "Yes"),
        previous_history=(previous_history == "Yes")
    )
    
    return {
        "stone_detected": stone_detected,
        "result_text": result,
        "confidence": confidence,
        "risk_level": risk,
        "reasons": reasons,
        "is_valid_scan": is_valid,
        "validation_warning": warning_msg
    }

@app.post("/predict-ct")
async def predict_ct(
    image: UploadFile = File(...),
    mm_per_pixel: float = Form(0.10),
    age: int = Form(25),
    pain_level: int = Form(5),
    fever: str = Form("No"),
    vomiting: str = Form("No"),
    blood_in_urine: str = Form("No"),
    previous_history: str = Form("No")
):
    """
    Exposes YOLOv8 object detection model for CT scans.
    Computes precise stone diameters using mm_per_pixel, draws visual boxes,
    and returns a base64 encoded marked image alongside clinical risk factors.
    """
    # Read uploaded file as PIL Image and convert to RGB
    contents = await image.read()
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    
    # Validate image
    is_valid, warning_msg = is_medical_scan(pil_image)
    
    # Detect stone sizes and draw bounding boxes using existing YOLO script
    output_image, detections = detect_ct_stone_size(pil_image, mm_per_pixel)
    
    stone_detected = len(detections) > 0
    detected_size_mm = 0.0
    highest_confidence = 0.0
    
    if stone_detected:
        # Find maximum stone size and highest confidence for summary
        detected_size_mm = max(d["size_mm"] for d in detections)
        highest_confidence = max(d["confidence"] for d in detections)
        
    # Calculate Patient Risk Scoring
    risk, reasons = calculate_risk(
        stone_detected=stone_detected,
        stone_size_mm=detected_size_mm,
        pain_level=pain_level,
        fever=(fever == "Yes"),
        vomiting=(vomiting == "Yes"),
        blood_in_urine=(blood_in_urine == "Yes"),
        previous_history=(previous_history == "Yes")
    )
    
    # Encode output_image with bounding boxes to base64 JPEG string
    buffered = io.BytesIO()
    output_image.save(buffered, format="JPEG")
    marked_image_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    return {
        "stone_detected": stone_detected,
        "confidence": highest_confidence,
        "detections": detections,
        "risk_level": risk,
        "reasons": reasons,
        "marked_image_base64": marked_image_base64,
        "is_valid_scan": is_valid,
        "validation_warning": warning_msg
    }
