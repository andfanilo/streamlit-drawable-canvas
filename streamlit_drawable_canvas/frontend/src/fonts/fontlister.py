import os

# Directory where your fonts are located
font_dir = './'  # Change this to your actual path

# Supported font extensions
font_extensions = ('.ttf', '.woff', '.otf', '.woff2')

# Output list of font-face declarations
font_face_list = []

# Loop through all files in the font directory
for font_file in os.listdir(font_dir):
    if font_file.endswith(font_extensions):
        font_name = os.path.splitext(font_file)[0]  # Strip the extension to get the font name
        font_path = f'fonts/{font_file}'
        
        # Create the @font-face rule
        font_face = f"""
@font-face {{
    font-family: '{font_name}';
    src: url('{font_path}');
}}
"""
        font_face_list.append(font_face)

# Combine all the @font-face rules into one output string
output = "\n".join(font_face_list)

# Output the result
print(output)
