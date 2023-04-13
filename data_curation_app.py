import streamlit as st
from streamlit_drawable_canvas import st_canvas
from PIL import Image
import json
from pdf2image import convert_from_path
import os
import argparse
from utils import get_image_file_name, read_and_format_json, read_document, resize_image, scale_bounding_box, save_current_state, handle_wrong_datapoint, handle_missing_datapoint, handle_user_choice

parser = argparse.ArgumentParser()
parser.add_argument("-i", "--input", dest="input", help="path of the input JSON file", required=True)
parser.add_argument("-im", "--image", dest="image", help="path of invoice files", required=True)
args = parser.parse_args()
OCR_results_path = args.input
images_path = args.image


# def get_image_file_name(json_file_name, image_path):
#     for image_file_name in os.listdir(image_path):
#         if os.path.splitext(image_file_name)[0] == json_file_name[:-5]:
#             return image_file_name
#
#
# def read_and_format_json(folder_path, filename):
#     with open(os.path.join(folder_path, filename), "r") as file:
#         return json.load(file)
#
#
# # TODO handle multiple pages of pdf
# def read_document(file_name, image_path):
#     file_extension = os.path.splitext(file_name)[1].lower()
#     if file_extension in ['.jpg', '.jpeg', '.png', '.heic', '.bmp', '.gif', '.tiff', '.tif', '.webp', '.heif']:
#         image = Image.open(os.path.join(image_path, file_name))
#     elif file_extension == '.pdf':
#         image = convert_from_path(os.path.join(image_path, file_name))[0]
#     else:
#         raise ValueError(f"Unsupported file format: {file_extension}")
#     return image
#
#
# def resize_image(image, max_width, max_height):
#     aspect_ratio = float(image.size[1]) / float(image.size[0])
#     new_width = max_width
#     new_height = int(new_width * aspect_ratio)
#
#     if new_height > max_height:
#         new_height = max_height
#         new_width = int(new_height / aspect_ratio)
#
#     width_scale = float(new_width) / float(image.size[0])
#     height_scale = float(new_height) / float(image.size[1])
#
#     image.thumbnail((new_width, new_height))
#     return image, width_scale, height_scale
#
#
# def scale_bounding_box(bounding_boxes, width_scale, height_scale):
#     for index, obj in enumerate(bounding_boxes):
#         bounding_boxes[index]["left"] *= width_scale
#         bounding_boxes[index]["top"] *= height_scale
#         bounding_boxes[index]["width"] *= width_scale
#         bounding_boxes[index]["height"] *= height_scale
#     return bounding_boxes
#
#
def next_page():
    if st.session_state["file_index"] < len(st.session_state["OCR_output_files"]):
        st.session_state["file_index"] += 1

    st.experimental_rerun()


def previous_page():
    if st.session_state["file_index"] > -1:
        st.session_state["file_index"] -= 1

    st.experimental_rerun()
#
#
# def save_current_state(file_name, bounding_boxes, label_folder_path):
#
#     with open(os.path.join(label_folder_path, file_name), "r") as json_file:
#         saved_bounding_boxes = json.load(json_file)
#
#     for idx, saved_bounding_box in enumerate(saved_bounding_boxes):
#         saved_bounding_box["user_reviewed"] = bounding_boxes[idx].get("user_reviewed", 0)
#         saved_bounding_box["result"] = bounding_boxes[idx].get("result", True)
#         saved_bounding_box["missing_information"] = bounding_boxes[idx].get("missing_information", False)
#         saved_bounding_box["wrong_datapoint"] = bounding_boxes[idx].get("wrong_datapoint", False)
#
#     with open(os.path.join(label_folder_path, file_name), "w") as json_file:
#         json.dump(saved_bounding_boxes, json_file, indent=2)
#
#
# def handle_wrong_datapoint(bounding_boxes):
#     for obj in bounding_boxes:
#         obj["wrong_datapoint"], obj["user_reviewed"], obj["result"], obj["missing_information"] = True, 1, False, False
#     return bounding_boxes
#
#
# def handle_missing_datapoint(bounding_boxes):
#     for obj in bounding_boxes:
#         obj["missing_information"], obj["user_reviewed"], obj["result"], obj["wrong_datapoint"] = True, 1, False, False
#     return bounding_boxes
#
#
# def handle_user_choice(bounding_boxes, canvas_bounding_boxes):
#     any_green_box = False
#     for i, canvas_bounding_box in enumerate(canvas_bounding_boxes):
#         ocr_bounding_box = bounding_boxes[i]
#         if canvas_bounding_box["fill"] == "rgb(208, 240, 192, 0.2)":
#             any_green_box = True
#             ocr_bounding_box["result"] = True
#         ocr_bounding_box["user_reviewed"] = 1
#         ocr_bounding_box["missing_information"] = False
#         ocr_bounding_box["wrong_datapoint"] = False
#         ocr_bounding_box.update(canvas_bounding_box)
#     return any_green_box, bounding_boxes


def handle_image_and_bounding_box(OCR_results_file, label_folder_path, images_path):
    image_file_name = get_image_file_name(OCR_results_file, images_path)
    if image_file_name is None:
        next_page()
    image = read_document(image_file_name, images_path)
    image, width_scale, height_scale = resize_image(image, 800, 800)
    bounding_boxes = read_and_format_json(label_folder_path, OCR_results_file)
    bounding_boxes = scale_bounding_box(bounding_boxes, width_scale, height_scale)
    # if len(bounding_boxes) == 1:
    #     next_page()
    # elif len(bounding_boxes) == 0:
    #     handle_missing_datapoint(bounding_boxes)
    #     next_page()
    return image, image_file_name, bounding_boxes


st.markdown(
    "<h1 style='text-align: center;'>Invoice Data Collection Application</h1>",
    unsafe_allow_html=True
)

if "selected_label" not in st.session_state:
    st.session_state["selected_label"] = ""

if "file_index" not in st.session_state:
    st.session_state["file_index"] = -1

if st.session_state["file_index"] <= -1:

    st.markdown(
        "<h1 style='text-align: center;'>Let's start</h1>",
        unsafe_allow_html=True
    )
    labels = os.listdir(OCR_results_path)
    label = st.selectbox("Select the Label:", labels)
    if st.session_state["selected_label"] != label:
        st.session_state["selected_label"] = label
        st.session_state["label_folder_path"] = os.path.join(OCR_results_path, label)
        st.session_state["OCR_output_files"] = os.listdir(os.path.join(OCR_results_path, label))
    col3, col4 = st.columns([8, 1])
    if col4.button("Next"):
        next_page()

elif st.session_state["file_index"] >= len(st.session_state["OCR_output_files"]):
    st.markdown("<h1 style='text-align: center;'>You're done!</h1>", unsafe_allow_html=True)

elif "label_folder_path" in st.session_state:
    OCR_results_file = st.session_state["OCR_output_files"][st.session_state["file_index"]]
    image, image_file_name, bounding_boxes = handle_image_and_bounding_box(OCR_results_file, st.session_state["label_folder_path"], images_path)
    canvas_result = st_canvas(
        background_image=image,
        display_toolbar=False,
        update_streamlit=True,
        height=image.size[1],
        width=image.size[0],
        drawing_mode="transform",
        key=image_file_name,
        initial_drawing={"objects": bounding_boxes},
    )
    st.write(image_file_name)
    st.write("")
    st.write("")

    if st.session_state["file_index"] > -1 and st.session_state["file_index"] != len(st.session_state["OCR_output_files"]):
        cols = st.columns([2, 1, 2])
        with cols[1]:
            if st.button("Wrong data point") and 0 <= st.session_state["file_index"] < len(st.session_state["OCR_output_files"]):
                save_current_state(st.session_state["OCR_output_files"][st.session_state["file_index"]], handle_wrong_datapoint(bounding_boxes), st.session_state["label_folder_path"])
                next_page()

        with cols[1]:
            if st.button("Missing information") and 0 <= st.session_state["file_index"] < len(st.session_state["OCR_output_files"]):
                save_current_state(st.session_state["OCR_output_files"][st.session_state["file_index"]], handle_missing_datapoint(bounding_boxes), st.session_state["label_folder_path"])
                next_page()

    st.write("")
    st.write("")

    col3, col4 = st.columns([8, 1])
    if col3.button("Previous"):
        previous_page()
    if col4.button("Next"):
        next_page()

    if canvas_result.json_data is not None:
        any_green_box, bounding_boxes = handle_user_choice(bounding_boxes, canvas_result.json_data["objects"])
        if any_green_box:
            save_current_state(OCR_results_file, bounding_boxes, st.session_state["label_folder_path"])
            next_page()

