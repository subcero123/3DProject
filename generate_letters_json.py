import os
import json

GCODE_DIR = "text-to-gcode_v2/ascii_gcode"
letters = {}

# Symbol name to character mapping
symbol_map = {
    "ampersand": "&",
    "apostrophe": "'",
    "asterisk": "*",
    "at": "@",
    "backslash": "\\",
    "backtick": "`",
    "caret": "^",
    "colon": ":",
    "comma": ",",
    "dollar": "$",
    "equals": "=",
    "exclamation_mark": "!",
    "full_point": ".",
    "greater_than": ">",
    "hash": "#",
    "left_curly_bracket": "{",
    "left_parenthesis": "(",
    "left_square_bracket": "[",
    "less_than": "<",
    "minus": "-",
    "percent": "%",
    "plus": "+",
    "question_mark": "?",
    "quotation_marks": '"',
    "right_curly_bracket": "}",
    "right_parenthesis": ")",
    "right_square_bracket": "]",
    "semicolon": ";",
    "slash": "/",
    "tilde": "~",
    "underscore": "_",
    "vertical_bar": "|",
}

for root, _, filenames in os.walk(GCODE_DIR):
    for filename in filenames:
        if not filename.endswith(".nc"):
            continue
        filepath = os.path.join(root, filename)
        with open(filepath, "r") as f:
            lines = f.read().replace("\r\n", "\n").strip().split("\n")

        # First line is (X) where X is the character
        header = lines[0].strip()
        char = header[1]  # extract character from (X)

        # For symbol files, use the filename mapping instead
        if "symbols" in root:
            name = filename.replace(".nc", "")
            if name in symbol_map:
                char = symbol_map[name]

        # Parse G-code instructions
        instructions = []
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            g_type = parts[0]  # G0 or G1
            x = 0.0
            y = 0.0
            for p in parts[1:]:
                if p.startswith("X"):
                    x = float(p[1:])
                elif p.startswith("Y"):
                    y = float(p[1:])
            instructions.append({"type": g_type, "x": x, "y": y})

        letters[char] = instructions

# Write JSON
with open("letters_data.json", "w") as f:
    json.dump(letters, f, indent=None)

print(f"Extracted {len(letters)} characters")
print("Characters:", sorted(letters.keys()))
