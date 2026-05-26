import streamlit as st
from PIL import Image
from predict import predict_kidney_stone
from risk import calculate_risk
from ct_yolo_size import detect_ct_stone_size

st.set_page_config(
    page_title="Kidney Stone Detection System",
    page_icon="🩺",
    layout="centered"
)

st.title("AI-Based Kidney Stone Detection and Size Estimation")

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