import streamlit as st
from streamlit_drawable_canvas import st_canvas
from PIL import Image
import json
import pandas as pd
from pdf2image import convert_from_path
import os

FILENAME = "docs/data_invoices_line.csv"
image_dir = "docs/image/"
json_dir = "docs/json/"
os.makedirs(json_dir, exist_ok=True)

image_files = [f for f in os.listdir(image_dir) if f.endswith(".pdf")]
json_files = [f for f in os.listdir(json_dir) if f.endswith(".json")]

image_files.sort()
json_files.sort()

files = [
    {
        "image": os.path.join(image_dir, image_file),
        "json": os.path.join(json_dir, json_file),
        "key": os.path.splitext(image_file)[0],
    }
    for image_file, json_file in zip(image_files, json_files)
]
def create_csv_file(filename):
    df = pd.read_csv(filename, sep="|")
    new_df = df[["filename",
                 "content",
                 'x_min',
                 'x_max',
                 'y_min',
                 'y_max',
                 'label'
                ]]
    new_df["left"] = new_df["x_min"]
    new_df["top"] = new_df["y_min"]
    new_df["width"] = abs(new_df["x_min"] - new_df["x_max"])
    new_df["height"] = abs(new_df["y_min"] - new_df["y_max"])
    new_df["type"] = "rect"
    new_df["fill"] = "rgba(255, 0, 0, 0.2)"
    new_df["stroke"] = "red"
    new_df["result"] = False
    new_df["user_reviewed"] = 0
    return new_df

def create_output_json(data_list):
    return {
        "objects": [
            {
                "type": item["type"],
                "left": item["left"],
                "top": item["top"],
                "width": item["width"],
                "height": item["height"],
                "fill": item["fill"],
                "stroke": item["stroke"],
                "content": item["content"],
                "label": item["label"],
                "result": item["result"],
                "file_name": item["filename"],
                "user_reviewed": item["user_reviewed"]
            }
            for item in data_list
        ]
    }

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

def scale_bounding_box(saved_state, width_scale, height_scale):
    is_single_object = len(saved_state["objects"]) == 1
    for index, obj in enumerate(saved_state["objects"]):
        saved_state["objects"][index]["left"] *= width_scale
        saved_state["objects"][index]["top"] *= height_scale
        saved_state["objects"][index]["width"] *= width_scale
        saved_state["objects"][index]["height"] *= height_scale
    return saved_state, is_single_object

def next_page():
    if st.session_state["file_index"] < len(files) - 1:
        st.session_state["file_index"] += 1
        if st.session_state["file_index"] in st.session_state["skipped_files"]:
            next_page()
        else:
            st.experimental_rerun()
    elif st.session_state["file_index"] == len(files) - 1:
        st.session_state["file_index"] += 1
        st.experimental_rerun()

def previous_page():
    if st.session_state["file_index"] > 0:
        st.session_state["file_index"] -= 1
        if st.session_state["file_index"] in st.session_state["skipped_files"]:
            previous_page()
        else:
            st.experimental_rerun()
    elif st.session_state["file_index"] == 0:
        st.session_state["file_index"] -= 1
        st.experimental_rerun()

def main():
    st.markdown(
        "<h1 style='text-align: center;'>Invoice Data Collection Application</h1>",
        unsafe_allow_html=True
    )
    if "skipped_files" not in st.session_state:
        st.session_state["skipped_files"] = []

    if "file_index" not in st.session_state:
        st.session_state["file_index"] = -1
    file_index = st.session_state["file_index"]

    labels = {"O": 0,
              "invoice_number": 1,
              "due_date": 2,
              "invoicing_date": 3,
              "company_name": 4,
              "vat_number": 5,
              "iban": 6,
              "ht_amount": 7,
              "vat_amount": 8,
              "ttc_amount": 9,
              "currency": 10,
              }
    if st.session_state["file_index"] == -1:
        label = st.selectbox(
        "Select the Label:", ("invoice_number",
                              "due_date",
                              "invoicing_date",
                              "company_name",
                              "vat_number",
                              "iban",
                              "ht_amount",
                              "vat_amount",
                              "ttc_amount",
                              "currency",
                              "0")
    )
        selected_label_value = labels[label]
        df = create_csv_file(FILENAME)
        grouped_df = df[df['label'].isin([selected_label_value])].groupby('filename')

        for file_name, group in grouped_df:
            group = group.reset_index(drop=True)
            data_list = group.to_dict('records')
            output_json = create_output_json(data_list)

            with open(os.path.join(json_dir, f"{file_name}_output.json"), "w") as outfile:
                json.dump(output_json, outfile, indent=2)


    if st.session_state["file_index"] <= -1:
        st.markdown(
            "<h1 style='text-align: center;'>Let's start</h1>",
            unsafe_allow_html=True
        )

    elif st.session_state["file_index"] >= len(files):
        st.markdown(
            "<h1 style='text-align: center;'>You're done!</h1>",
            unsafe_allow_html=True
        )

    else:
        file = files[file_index]
        # image = Image.open(file["image"])
        image = convert_from_path(file["image"])[0]
        image, width_scale, height_scale = resize_image(image, 800, 800)

        saved_state_key = f'saved_state_{file["key"]}'

        if saved_state_key not in st.session_state:
            with open(file["json"], "r") as f:
                saved_state = json.load(f)
                saved_state, is_single_object = scale_bounding_box(saved_state, width_scale, height_scale)
                if is_single_object:
                    st.session_state["skipped_files"].append(file_index)
                    next_page()
                else:
                    st.session_state[saved_state_key] = saved_state
        else:
            saved_state = st.session_state[saved_state_key]

        canvas_result = st_canvas(
            background_image=image,
            display_toolbar=True,
            update_streamlit=True,
            height=image.size[1],
            width=image.size[0],
            drawing_mode="transform",
            key=file["key"],
            initial_drawing=saved_state,
        )
    # Create new_folder and store the results
        base_json_filename = os.path.splitext(os.path.basename(file["json"]))[0]
        result_folder = os.path.join(json_dir, "results")
        os.makedirs(result_folder, exist_ok=True)
        new_json_file = os.path.join(result_folder, f"{base_json_filename}_result.json")

        if canvas_result.json_data is not None:
            objects_with_green_fill = []

            for idx, obj in enumerate(canvas_result.json_data["objects"]):
                if obj.get("fill") == "rgb(208, 240, 192, 0.2)":
                    objects_with_green_fill.append(idx)

            if objects_with_green_fill:
                updated_objects = []
                for idx, obj in enumerate(saved_state["objects"]):
                    if idx in objects_with_green_fill:
                        obj["result"], obj["user_reviewed"] = True, 1
                        updated_objects.append(obj)

                with open(new_json_file, "w") as f:
                    json.dump({"objects": updated_objects}, f, indent=2)
                    st.session_state[saved_state_key] = saved_state

                    st.session_state["file_index"] = (file_index + 1)
                    st.experimental_rerun()

    st.write("")
    st.write("")

    col3, col4 = st.columns([9, 1])
    if col3.button("Previous"):
        previous_page()

    if col4.button("Next"):
        next_page()

if __name__ == '__main__':
    main()
