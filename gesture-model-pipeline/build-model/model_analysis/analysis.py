import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, roc_curve, auc
from sklearn.preprocessing import label_binarize
import os

CSV_FILE_PATH = 'evaluation_results.csv'
OUTPUT_DIR = 'evaluation_plots'
REPORT_FILE_PATH = os.path.join(OUTPUT_DIR, 'summary_report.txt')

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Created directory: {OUTPUT_DIR}")

    df, labels = load_and_prepare_data(CSV_FILE_PATH)
    if df is None:
        return

    # Generate and save the text-based summary report
    generate_summary_report(df, labels, REPORT_FILE_PATH)

    # Generate and save plots
    print("\n" + "="*50)
    print("      Generating Visual Plots")
    print("="*50)
    plot_confusion_matrix(df['TrueLabel'], df['PredictedLabel'], labels, OUTPUT_DIR)
    plot_roc_curves(df, labels, OUTPUT_DIR)
    plot_probability_distributions(df, labels, OUTPUT_DIR)
    print(f"\n All plots saved to the '{OUTPUT_DIR}' directory.")

def load_and_prepare_data(csv_path):
    try:
        print(f"Loading data from '{csv_path}'...")
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        print(f"Error: The file '{csv_path}' was not found.")
        return None, None

    # Identify the probability columns
    prob_cols = [col for col in df.columns if col.startswith('Prob_')]
    labels = sorted([col.replace('Prob_', '') for col in prob_cols])

    # Add a 'PredictedLabel' column by finding the class with the max probability
    df['PredictedLabel'] = df[prob_cols].idxmax(axis=1).str.replace('Prob_', '')

    original_rows = len(df)
    df.dropna(subset=['TrueLabel'], inplace=True)
    if len(df) < original_rows:
        print(f"Dropped {original_rows - len(df)} rows with missing TrueLabel.")

    df['TrueLabel'] = df['TrueLabel'].astype(str)
    df['PredictedLabel'] = df['PredictedLabel'].astype(str)

    print("Data loaded and prepared successfully.")
    return df, labels

def generate_summary_report(df, labels, output_path):
    print("\n" + "="*50)
    print("      Generating Summary Report")
    print("="*50)

    # Get classification report as a string, ensuring labels are passed for consistency
    report_str = classification_report(df['TrueLabel'], df['PredictedLabel'], labels=labels, digits=3, zero_division=0)

    # Get top misclassifications as a string
    misclassified = df[df['TrueLabel'] != df['PredictedLabel']]
    error_counts = misclassified.groupby(['TrueLabel', 'PredictedLabel']).size().nlargest(5)

    misclass_str = "Top Misclassifications (True -> Predicted):\n"
    if error_counts.empty:
        misclass_str += "No misclassifications found!\n"
    else:
        for (true, pred), count in error_counts.items():
            misclass_str += f"- {true} -> {pred}: {count} times\n"

    # Combine all text into a single report
    full_report = (
        "========================================\n"
        "      Classification Report\n"
        "========================================\n"
        f"{report_str}\n\n"
        "========================================\n"
        "      Top Misclassifications\n"
        "========================================\n"
        f"{misclass_str}"
    )

    # Write the report to a file
    with open(output_path, 'w') as f:
        f.write(full_report)
    print(f"- Summary report saved to '{output_path}'")

def plot_confusion_matrix(y_true, y_pred, labels, output_dir):
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    plt.figure(figsize=(12, 10))
    ax = sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=labels, yticklabels=labels, annot_kws={'size': 14})
    cbar = ax.collections[0].colorbar
    cbar.ax.tick_params(labelsize=14)
    plt.title('Confusion Matrix', fontsize=18)
    plt.ylabel('True Label', fontsize=16)
    plt.xlabel('Predicted Label', fontsize=16)
    plt.xticks(rotation=45, fontsize=14)
    plt.yticks(rotation=0, fontsize=14)
    plt.tight_layout()
    save_path = os.path.join(output_dir, 'confusion_matrix.png')
    plt.savefig(save_path)
    plt.close()
    print(f"- Confusion matrix saved to '{save_path}'")

def plot_roc_curves(df, labels, output_dir):
    y_true_binarized = label_binarize(df['TrueLabel'], classes=labels)
    prob_cols = [f'Prob_{label}' for label in labels]
    y_scores = df[prob_cols].values
    n_classes = len(labels)

    fpr = dict()
    tpr = dict()
    roc_auc = dict()

    for i in range(n_classes):
        fpr[i], tpr[i], _ = roc_curve(y_true_binarized[:, i], y_scores[:, i])
        roc_auc[i] = auc(fpr[i], tpr[i])

    plt.figure(figsize=(10, 8))
    for i in range(n_classes):
        plt.plot(fpr[i], tpr[i], lw=2,
                 label=f'ROC curve for {labels[i]} (AUC = {roc_auc[i]:.3f})')

    plt.plot([0, 1], [0, 1], 'k--', lw=2)
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate', fontsize=12)
    plt.ylabel('True Positive Rate', fontsize=12)
    plt.title('Receiver Operating Characteristic (ROC) Curves', fontsize=16)
    plt.legend(loc="lower right")
    plt.grid(True)
    plt.tight_layout()
    save_path = os.path.join(output_dir, 'roc_curves.png')
    plt.savefig(save_path)
    plt.close()
    print(f"- ROC curves saved to '{save_path}'")

def plot_probability_distributions(df, labels, output_dir):
    correct_predictions = []
    for label in labels:
        # Get the probability the model assigned to the correct class, when it was correct
        correct_df = df[(df['TrueLabel'] == label) & (df['PredictedLabel'] == label)]
        if not correct_df.empty:
            probs = correct_df[f'Prob_{label}']
            correct_predictions.append(probs)
        else:
            correct_predictions.append(pd.Series(dtype='float64')) # Append empty series if no correct preds

    plt.figure(figsize=(14, 7))
    plt.boxplot(correct_predictions, vert=True, patch_artist=True, labels=labels)
    plt.title('Model Confidence on Correct Predictions', fontsize=16)
    plt.ylabel('Predicted Probability', fontsize=12)
    plt.xlabel('Gesture Class', fontsize=12)
    plt.xticks(rotation=45)
    plt.grid(axis='y', linestyle='--', alpha=0.7)
    plt.tight_layout()
    save_path = os.path.join(output_dir, 'probability_distributions.png')
    plt.savefig(save_path)
    plt.close()
    print(f"- Probability distributions saved to '{save_path}'")

if __name__ == '__main__':
    main()