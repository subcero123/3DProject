import sys
import os
import requests
import importlib.util

PRINTER = "192.168.137.34"
URL = f"http://{PRINTER}/printer/gcode/script"

TEXT_TO_PRINT = "HELLO WORLD"

LINE_LENGTH = 300
LINE_SPACING = 10
PADDING = 3
OFFSET_X = 25
OFFSET_Y = 200
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEXT_TO_GCODE_DIR = os.path.join(BASE_DIR, "text-to-gcode_v2")
GCODE_DIR = os.path.join(TEXT_TO_GCODE_DIR, "ascii_gcode")
OUTPUT_FILE = "output.nc"

module_path = os.path.join(TEXT_TO_GCODE_DIR, "text_to_gcode.py")
spec = importlib.util.spec_from_file_location("text_to_gcode", module_path)
text_to_gcode = importlib.util.module_from_spec(spec)
spec.loader.exec_module(text_to_gcode)
readLetters = text_to_gcode.readLetters
textToGcode = text_to_gcode.textToGcode

letters = readLetters(GCODE_DIR)
gcode = textToGcode(letters, TEXT_TO_PRINT, LINE_LENGTH, LINE_SPACING, PADDING, OFFSET_X, OFFSET_Y)

with open(OUTPUT_FILE, "w") as f:
    f.write(gcode)
print(f"[OK] G-code saved at:  {OUTPUT_FILE}")

gcode_with_z = (
    "SAVE_GCODE_STATE NAME=TEXT_TO_GCODE\n"
    "G90\n"
    "G21\n"
    "G0 Z27.42\n"
    f"{gcode}"
    "RESTORE_GCODE_STATE NAME=TEXT_TO_GCODE\n"
)
response = requests.post(URL, json={"script": gcode_with_z})

print(f"[OK] Response: {response.status_code}")
print(response.text)
