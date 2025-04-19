#!/usr/bin/env python3
import csv
import re
from pathlib import Path

# —— CONFIG ——
NAMES_CSV = Path("./cleaned/names.csv")  # your CSV with header "name"
IMAGES_DIR = Path("./all_images")  # adjust to your images folder
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
# ——————————


def build_name_map(csv_path):
    """
    Read the CSV (with a header 'name') and build a map:
      lowercase last_name -> normalized first_name (underscored, lowercase)
    """
    mapping = {}
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            full = row["name"].strip()
            if not full:
                continue
            parts = full.split()
            last = parts[-1].lower()
            first = "_".join(parts[:-1]).lower() or last  # if only one name, first=last
            mapping[last] = first
    return mapping


def rename_images(name_map, images_dir):
    """
    Scan images_dir for files named <lastname><year>.<ext>
    and rename them to <first>_<last>_<year>.<ext>
    """
    pattern = re.compile(r"^([A-Za-z]+)(\d{4})$")
    for img_path in images_dir.iterdir():
        if img_path.suffix.lower() not in IMAGE_EXTS:
            continue

        basename = img_path.stem  # e.g. "bains2021"

        if "_" in basename:
            print(f"⏭ skipping (already normalized): {img_path.name}")
            continue

        basename = img_path.stem  # e.g. 'bains2021'
        m = pattern.match(basename)
        if not m:
            print(f"• skipping (no match): {img_path.name}")
            continue

        last_raw, year = m.groups()
        last = last_raw.lower()
        first = name_map.get(last)
        if not first:
            print(f"• no CSV entry for last='{last}' (file: {img_path.name})")
            continue

        new_name = f"{first}_{last}_{year}{img_path.suffix.lower()}"
        new_path = img_path.with_name(new_name)

        if new_path.exists():
            print(f"‼️ target exists, skipping: {new_name}")
        else:
            img_path.rename(new_path)
            print(f"✅ {img_path.name} → {new_name}")


def main():
    if not NAMES_CSV.exists():
        print(f"ERROR: names CSV not found at {NAMES_CSV}")
        return
    if not IMAGES_DIR.is_dir():
        print(f"ERROR: images directory not found at {IMAGES_DIR}")
        return

    name_map = build_name_map(NAMES_CSV)
    rename_images(name_map, IMAGES_DIR)


if __name__ == "__main__":
    main()
