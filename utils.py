from PIL import Image
import json
from pdf2image import convert_from_path
import os
import shutil


def get_image_file_name(json_file_name, image_path):
    for image_file_name in os.listdir(image_path):
        if os.path.splitext(image_file_name)[0] == json_file_name[:-5]:
            return image_file_name


# TODO handle multiple pages of pdf
def read_document(file_name, image_path):
    file_extension = os.path.splitext(file_name)[-1].lower()
    if file_extension in ['.jpg', '.jpeg', '.png', '.heic', '.bmp', '.gif', '.tiff', '.tif', '.webp', '.heif']:
        image = Image.open(os.path.join(image_path, file_name))
    elif file_extension == '.pdf':
        image = convert_from_path(os.path.join(image_path, file_name))[0]
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")
    return image


def resize_image(image, max_width, max_height):
    aspect_ratio = float(image.size[1]) / float(image.size[0])
    new_width = max_width
    new_height = int(new_width * aspect_ratio)

    if new_height > max_height:
        new_height = max_height
        new_width = int(new_height / aspect_ratio)

    width_scale = float(new_width) / float(image.size[0])
    height_scale = float(new_height) / float(image.size[1])

    image.thumbnail((new_width, new_height))
    return image, width_scale, height_scale


def scale_bounding_box(bounding_boxes, width_scale, height_scale):
    for index, obj in enumerate(bounding_boxes):
        bounding_boxes[index]["left"] *= width_scale
        bounding_boxes[index]["top"] *= height_scale
        bounding_boxes[index]["width"] *= width_scale
        bounding_boxes[index]["height"] *= height_scale
    return bounding_boxes


def save_current_state(file_name, bounding_boxes, label_folder_path):

    with open(os.path.join(label_folder_path, file_name), "r") as json_file:
        saved_bounding_boxes = json.load(json_file)

    for idx, saved_bounding_box in enumerate(saved_bounding_boxes):
        saved_bounding_box["user_reviewed"] = bounding_boxes[idx].get("user_reviewed", 0)
        saved_bounding_box["result"] = bounding_boxes[idx].get("result", True)
        saved_bounding_box["missing_information"] = bounding_boxes[idx].get("missing_information", False)
        saved_bounding_box["wrong_datapoint"] = bounding_boxes[idx].get("wrong_datapoint", False)

    with open(os.path.join(label_folder_path, file_name), "w") as json_file:
        json.dump(saved_bounding_boxes, json_file, indent=2)


def handle_wrong_datapoint(bounding_boxes):
    for obj in bounding_boxes:
        obj["wrong_datapoint"], obj["user_reviewed"], obj["result"], obj["missing_information"] = True, 1, False, False
    return bounding_boxes


def handle_missing_datapoint(bounding_boxes):
    for obj in bounding_boxes:
        obj["missing_information"], obj["user_reviewed"], obj["result"], obj["wrong_datapoint"] = True, 1, False, False
    return bounding_boxes


def handle_user_choice(bounding_boxes, canvas_bounding_boxes):
    any_green_box = False
    for i, canvas_bounding_box in enumerate(canvas_bounding_boxes):
        ocr_bounding_box = bounding_boxes[i]
        if canvas_bounding_box["fill"] == "rgb(208, 240, 192, 0.2)":
            any_green_box = True
            ocr_bounding_box["result"] = True
        ocr_bounding_box["user_reviewed"] = 1
        ocr_bounding_box["missing_information"] = False
        ocr_bounding_box["wrong_datapoint"] = False
        ocr_bounding_box.update(canvas_bounding_box)
    return any_green_box, bounding_boxes
