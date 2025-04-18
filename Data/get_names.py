import pandas as pd

weekly = pd.read_csv("./cleaned/Inseason_24_ForcePlate_Weekly_Cleaned.csv")
base = pd.read_csv("./cleaned/Inseason_24_ForcePlate_Baseline_Cleaned.csv")
nord = pd.read_csv("./cleaned/Inseason_24_NordBoard_Cleaned.csv")

names = set(weekly["name"]).union(set(base["name"])).union(set(nord["name"]))

names_df = pd.DataFrame({"name": sorted(names)})
names_df.to_csv("./cleaned/names.csv", index=False)
