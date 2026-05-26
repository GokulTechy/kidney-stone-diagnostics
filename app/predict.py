import tensorflow as tf
import numpy as np
from PIL import Image

IMG_SIZE = 224

model = tf.keras.models.load_model("models/kidney_stone_ultrasound_model.h5")

def predict_kidney_stone(image):
    image = image.convert("RGB")
    image = image.resize((IMG_SIZE, IMG_SIZE))

    img_array = np.array(image) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    prediction = model.predict(img_array)[0][0]

    if prediction >= 0.5:
        result = "Stone Detected"
        confidence = prediction * 100
    else:
        result = "No Stone Detected"
        confidence = (1 - prediction) * 100

    return result, round(confidence, 2)