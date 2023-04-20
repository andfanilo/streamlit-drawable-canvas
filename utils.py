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
    for index, obj in enumerate(bounding_boxes["objects"]):
        bounding_boxes["objects"][index]["left"] *= width_scale
        bounding_boxes["objects"][index]["top"] *= height_scale
        bounding_boxes["objects"][index]["width"] *= width_scale
        bounding_boxes["objects"][index]["height"] *= height_scale
    return bounding_boxes


def save_current_state(file_name, bounding_boxes, label_folder_path):

    with open(os.path.join(label_folder_path, file_name), "r") as json_file:
        saved_data = json.load(json_file)
        saved_data["user_reviewed"] = bounding_boxes.get("user_reviewed", 0)
        saved_data["missing_information"] = bounding_boxes.get("missing_information", False)
        saved_data["wrong_datapoint"] = bounding_boxes.get("wrong_datapoint", False)

    for idx, _ in enumerate(saved_data["objects"]):
        saved_data["objects"][idx]["result"] = bounding_boxes["objects"][idx].get("result", True)

    with open(os.path.join(label_folder_path, file_name), "w") as json_file:
        json.dump(saved_data, json_file, indent=2)


def handle_wrong_datapoint(data):
    data["wrong_datapoint"] = True
    data["user_reviewed"] = 1
    data["missing_information"] = False
    for obj in data["objects"]:
        obj["result"] = False
    return data


def handle_missing_datapoint(data):
    data["missing_information"] = True
    data["user_reviewed"] = 1
    data["wrong_datapoint"] = False
    for obj in data["objects"]:
        obj["result"] = False
    return data


def handle_user_choice(data, canvas_bounding_boxes):
    any_dark_green_box = False
    clicked_box_index = None

    for i, canvas_bounding_box in enumerate(canvas_bounding_boxes):
        if canvas_bounding_box["fill"] == "rgb(1, 50, 32, 0.2)":
            any_dark_green_box = True
            clicked_box_index = i
            break

    if any_dark_green_box:
        for i, ocr_bounding_box in enumerate(data["objects"]):
            ocr_bounding_box["result"] = (i == clicked_box_index)
            if i == clicked_box_index:
                ocr_bounding_box.update(canvas_bounding_boxes[clicked_box_index])

        data["user_reviewed"] = 1
        data["missing_information"] = False
        data["wrong_datapoint"] = False

    return any_dark_green_box, data

