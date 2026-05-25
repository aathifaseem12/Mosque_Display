import os
import json
import re
import pdfplumber
from datetime import datetime

# This points directly to your React app's assets folder
REACT_ASSETS_DIR = "./src/assets"
TIMETABLE_JSON = os.path.join(REACT_ASSETS_DIR, "timetable.json")

def sync_all_pdfs_to_timetable():
    print("Scanning for ACJU PDFs...")
    timetable = {}
    
    # Finds all PDFs in the folder where you run the script
    pdf_files = [f for f in os.listdir('.') if f.lower().endswith('.pdf')]
    
    row_regex = re.compile(r"(\d{1,2}-[A-Za-z]{3})")
    time_regex = re.compile(r"\d{1,2}:\d{2}\s?[APM]{2}")

    for pdf_filename in pdf_files:
        print(f"Processing {pdf_filename}...")
        try:
            with pdfplumber.open(pdf_filename) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if not text: continue
                    
                    for line in text.split('\n'):
                        date_match = row_regex.search(line)
                        times = time_regex.findall(line)
                        
                        if date_match and len(times) >= 6:
                            date_str = date_match.group(1)
                            current_year = datetime.now().year
                            
                            try:
                                date_obj = datetime.strptime(f"{date_str}-{current_year}", "%d-%b-%Y")
                                key = date_obj.strftime("%Y-%m-%d")

                                def to_list(t):
                                    dt = datetime.strptime(t.replace(" ", ""), "%I:%M%p")
                                    return [dt.hour, dt.minute]

                                timetable[key] = {
                                    "Fajr": to_list(times[0]), "Sunrise": to_list(times[1]),
                                    "Dhuhr": to_list(times[2]), "Asr": to_list(times[3]),
                                    "Maghrib": to_list(times[4]), "Isha": to_list(times[5])
                                }
                            except Exception as e:
                                continue
        except Exception as e:
            print(f"Error processing {pdf_filename}: {e}")
    
    # Create the assets folder if it doesn't exist yet
    os.makedirs(REACT_ASSETS_DIR, exist_ok=True)
    
    # Save the generated data straight into the React app
    with open(TIMETABLE_JSON, "w") as f:
        json.dump(timetable, f, indent=4)
        
    print(f"Success! {len(timetable)} days saved to {TIMETABLE_JSON}")

if __name__ == "__main__":
    sync_all_pdfs_to_timetable()