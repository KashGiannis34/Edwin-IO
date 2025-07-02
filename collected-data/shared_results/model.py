import json
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
from tensorflow.keras.utils import to_categorical
from tensorflowjs.converters import save_keras_model

with open("combined_gesture_samples.json") as f:
    data = json.load(f)

df = pd.DataFrame(data)
X = pd.DataFrame(df["vector"].tolist())
y = df["label"]

le = LabelEncoder()
y_encoded = le.fit_transform(y)
y_cat = to_categorical(y_encoded)

with open("label_mapping.json", "w") as f:
    json.dump({i: label for i, label in enumerate(le.classes_)}, f)

X_train, X_test, y_train, y_test = train_test_split(X, y_cat, test_size=0.2, random_state=42)

model = Sequential([
    Dense(64, activation='relu', input_shape=(42,)),
    Dropout(0.2),
    Dense(64, activation='relu'),
    Dropout(0.2),
    Dense(y_cat.shape[1], activation='softmax')
])

model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
model.fit(X_train, y_train, validation_data=(X_test, y_test), epochs=30, batch_size=32)

save_keras_model(model, "gesture_model_tfjs")