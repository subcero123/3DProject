import sys
import os
import requests

PRINTER = "192.168.137.124"
URL = f"http://{PRINTER}/printer/gcode/script"

TEXT_TO_PRINT = "HELLO WORLD"

LINE_LENGTH = 300
LINE_SPACING = 10
PADDING = 3
OFFSET_X = 25
OFFSET_Y = 200
GCODE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "text-to-gcode", "ascii_gcode")
OUTPUT_FILE = "output.nc"

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "text-to-gcode"))
from text_to_gcode import readLetters, textToGcode

letters = readLetters(GCODE_DIR)
gcode = textToGcode(letters, TEXT_TO_PRINT, LINE_LENGTH, LINE_SPACING, PADDING, OFFSET_X, OFFSET_Y)

with open(OUTPUT_FILE, "w") as f:
    f.write(gcode)
print(f"[OK] G-code saved at:  {OUTPUT_FILE}")

gcode_with_z = f"G0 Z27.42\n{gcode}"
response = requests.post(URL, json={"script": gcode_with_z})

print(f"[OK] Response: {response.status_code}")
print(response.text)
