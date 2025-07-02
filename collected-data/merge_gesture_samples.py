import os
import json

SOURCE_FOLDER = "data_collection"
OUTPUT_FOLDER = "shared_results"
OUTPUT_FILENAME = "combined_gesture_samples.json"

def load_json_file(filepath):
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            else:
                print(f"⚠️ Skipping non-list JSON in: {filepath}")
                return []
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return []

def merge_samples():
    all_samples = []
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    for filename in os.listdir(SOURCE_FOLDER):
        if filename.endswith(".json"):
            filepath = os.path.join(SOURCE_FOLDER, filename)
            samples = load_json_file(filepath)
            all_samples.extend(samples)

    output_path = os.path.join(OUTPUT_FOLDER, OUTPUT_FILENAME)
    with open(output_path, 'w') as f:
        json.dump(all_samples, f, indent=2)

    print(f"Merged {len(all_samples)} total samples into: {output_path}")

if __name__ == "__main__":
    merge_samples()