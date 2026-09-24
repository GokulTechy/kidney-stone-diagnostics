import streamlit as st
from PIL import Image
import numpy as np
from predict import predict_kidney_stone
from risk import calculate_risk
from ct_yolo_size import detect_ct_stone_size


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


st.set_page_config(
    page_title="LithoScan AI - Kidney Stone Detection & Analysis",
    page_icon="🩺",
    layout="centered"
)

st.title("LithoScan AI: Enhancing Kidney Stone Diagnosis with AI-Driven Medical Imaging")

tab1, tab2 = st.tabs([
    "Ultrasound Stone Detection",
    "CT Stone Size Estimation"
])


with tab1:
    st.header("Ultrasound Kidney Stone Detection")

    st.write(
        "Upload an ultrasound kidney image. "
        "The model predicts Stone / No Stone."
    )

    uploaded_file = st.file_uploader(
        "Upload ultrasound image",
        type=["jpg", "jpeg", "png"],
        key="ultrasound_upload"
    )

    st.subheader("Patient Symptom Details")

    age = st.number_input(
        "Age",
        min_value=1,
        max_value=120,
        value=25,
        key="us_age"
    )

    pain_level = st.slider(
        "Pain Level",
        0,
        10,
        5,
        key="us_pain"
    )

    fever = st.selectbox("Fever", ["No", "Yes"], key="us_fever")
    vomiting = st.selectbox("Vomiting", ["No", "Yes"], key="us_vomiting")
    blood_in_urine = st.selectbox("Blood in urine", ["No", "Yes"], key="us_blood")

    previous_history = st.selectbox(
        "Previous kidney stone history",
        ["No", "Yes"],
        key="us_history"
    )

    if uploaded_file is not None:
        image = Image.open(uploaded_file)
        st.image(
            image,
            caption="Uploaded Ultrasound Image",
            use_container_width=True
        )

        is_valid, warning_msg = is_medical_scan(image)
        if not is_valid:
            st.warning(f"⚠️ Warning: {warning_msg}")

        if st.button("Analyze Ultrasound Image"):
            result, confidence = predict_kidney_stone(image)

            stone_detected = result == "Stone Detected"

            risk, reasons = calculate_risk(
                stone_detected=stone_detected,
                stone_size_mm=0,
                pain_level=pain_level,
                fever=fever == "Yes",
                vomiting=vomiting == "Yes",
                blood_in_urine=blood_in_urine == "Yes",
                previous_history=previous_history == "Yes"
            )

            st.subheader("Prediction Result")
            st.write("Prediction:", result)
            st.write("Confidence:", str(confidence) + "%")

            st.subheader("Risk Assessment")
            st.write("Risk Level:", risk)

            st.write("Reasons:")
            for reason in reasons:
                st.write("-", reason)

            st.warning(
                "This is an AI-assisted academic project. "
                "It is not a final medical diagnosis."
            )


with tab2:
    st.header("CT Scan Stone Size Estimation")

    st.write(
        "Upload a CT scan image. "
        "YOLO detects the kidney stone region and shows estimated stone size in mm."
    )

    ct_file = st.file_uploader(
        "Upload CT scan image",
        type=["jpg", "jpeg", "png"],
        key="ct_upload"
    )

    st.subheader("Size Calibration")

    mm_per_pixel = st.number_input(
        "Enter mm per pixel value",
        min_value=0.01,
        max_value=10.0,
        value=0.10,
        step=0.01,
        key="ct_mm"
    )

    st.info(
        "The system converts detected stone diameter into millimeters using "
        "the entered mm-per-pixel value."
    )

    st.subheader("Patient Symptom Details")

    ct_pain_level = st.slider(
        "Pain Level",
        0,
        10,
        5,
        key="ct_pain"
    )

    ct_fever = st.selectbox("Fever", ["No", "Yes"], key="ct_fever")
    ct_vomiting = st.selectbox("Vomiting", ["No", "Yes"], key="ct_vomiting")
    ct_blood = st.selectbox("Blood in urine", ["No", "Yes"], key="ct_blood")

    ct_history = st.selectbox(
        "Previous kidney stone history",
        ["No", "Yes"],
        key="ct_history"
    )

    if ct_file is not None:
        ct_image = Image.open(ct_file).convert("RGB")

        st.image(
            ct_image,
            caption="Uploaded CT Scan Image",
            use_container_width=True
        )

        is_valid, warning_msg = is_medical_scan(ct_image)
        if not is_valid:
            st.warning(f"⚠️ Warning: {warning_msg}")

        if st.button("Detect Stone Size from CT"):
            output_image, detections = detect_ct_stone_size(
                ct_image,
                mm_per_pixel=mm_per_pixel
            )

            st.subheader("CT Detection Result")

            if len(detections) == 0:
                st.warning("No stone detected in the CT image.")
                detected_size_mm = 0
                stone_detected = False

            else:
                stone_detected = True
                detected_size_mm = 0

                st.image(
                    output_image,
                    caption="Detected Stone Region",
                    use_container_width=True
                )

                for i, detection in enumerate(detections):
                    st.write(f"Stone {i + 1}")
                    st.write(
                        "Detection Confidence:",
                        str(detection["confidence"]) + "%"
                    )

                    st.success(
                        f"Estimated Stone Size: {detection['size_mm']} mm"
                    )

                    detected_size_mm = max(
                        detected_size_mm,
                        detection["size_mm"]
                    )

                    st.markdown("---")

            risk, reasons = calculate_risk(
                stone_detected=stone_detected,
                stone_size_mm=detected_size_mm,
                pain_level=ct_pain_level,
                fever=ct_fever == "Yes",
                vomiting=ct_vomiting == "Yes",
                blood_in_urine=ct_blood == "Yes",
                previous_history=ct_history == "Yes"
            )

            st.subheader("Risk Assessment")
            st.write("Risk Level:", risk)

            st.write("Reasons:")
            for reason in reasons:
                st.write("-", reason)

            st.warning(
                "This is an AI-assisted academic project. "
                "The estimated size depends on the mm-per-pixel calibration value. "
                "It is not a final medical diagnosis."
            )