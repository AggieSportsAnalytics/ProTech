from supabase import create_client

SUPABASE_URL = "https://rjhtegugojeoooeelncm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqaHRlZ3Vnb2plb29vZWVsbmNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDkxNzc3OCwiZXhwIjoyMDYwNDkzNzc4fQ.SKdHT_4vv1zP16ogMcyZgPBdA2PypzlhUp0iXcVeGh8"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
bucket = "athlete-images"


def list_recursive(path=""):
    items = supabase.storage.from_(bucket).list(path)

    for item in items:
        base_path = item["name"]
        next_dir = supabase.storage.from_(bucket).list(base_path)
        for file in next_dir:
            if not file["name"].endswith(".jpg"):
                path = f"{base_path}/{file['name']}"
                yield path


all_image_paths = list_recursive()

for path in all_image_paths:
    try:
        print(f"Processing: {path}")

        img_bytes = supabase.storage.from_(bucket).download(path)
        if not isinstance(img_bytes, bytes):
            print(f"Skipping (not bytes): {path}")
            continue

        supabase.storage.from_(bucket).upload(
            f"{path}.jpg", img_bytes, {"content-type": "image/jpeg", "x-upsert": "true"}
        )

        print(f"Uploaded as: {path}.jpg")

        supabase.storage.from_(bucket).remove([path])

        print(f"Deleting old image, {path}")

    except Exception as e:
        print(f"Failed for {path}: {e}")
