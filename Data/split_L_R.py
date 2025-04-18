import pandas as pd

# 1) load your file (change sep="\t" to sep="," if it’s a commas file)
df = pd.read_csv("./cleaned/Inseason_24_ForcePlate_Weekly_Cleaned.csv")

# list of the three asymmetry columns you want to split
asym_cols = [
    "concentric_impulse_asym_percent",
    "eccentric_deceleration_impulse_asym_percent",
    "landing_impulse_asym_percent",
]

for col in asym_cols:
    # extract the numeric part when followed by 'L'
    df[f"{col}_L"] = (
        df[col]
        .astype(str)
        .str.extract(r"([-\d\.]+)\s*L")[0]
        .astype(float)
    )
    # extract the numeric part when followed by 'R'
    df[f"{col}_R"] = (
        df[col]
        .astype(str)
        .str.extract(r"([-\d\.]+)\s*R")[0]
        .astype(float)
    )

# if you no longer need the raw columns, uncomment this:
df.drop(columns=asym_cols, inplace=True)

# write out your new, cleaned table
df.to_csv("./cleaned/Inseason_24_ForcePlate_Weekly_Cleaned_2.csv", index=False)

print("Done — columns split and saved to ForcePlate_Baseline_Split_Asym.csv")