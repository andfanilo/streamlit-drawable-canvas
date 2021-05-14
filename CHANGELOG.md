# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2021-05-14

- `initial_drawing` is now used as the initial canvas state. If `None` provided then we create one on the Python side. This provokes the following changes:
  - a change in `background_color` will reset the drawing.
  - `background_color` will override the background color present in `initial_drawing`.
  - if `background_image` is present then `background_color` is removed from `st_canvas` call.
- Upgrade Fabric.js to version 4.4.0.
- Toolbar is now on the bottom left to account for large canvas width.
- Add argument to make the toolbar invisible.
- Make `stroke_width` the minimum size constraint to create a rectangle and circle. Thanks [hiankun](https://github.com/hiankun) for the PR!

## [0.6.0] - 2021-01-30

- Add `initial_drawing` argument to initialize canvas with an exported canvas state

## [0.5.2] - 2021-01-23

- Fix state issue with deleting an object through double click

## [0.5.1] - 2020-10-13

- Add undo/redo/clear buttons
- Add "Send to Streamlit" button for when "Realtime update" is disabled

## [0.4.0] - 2020-09-04

- Add Circle tool
- Add argument to fetch data back to Streamlit on demand

## [0.3.0] - 2020-08-27

### Added

- Add Rectangle tool
- Return JSON representation of canvas to Streamlit
- Add background image behind canvas

## [0.2.0] - 2020-08-20

### Added

- Add drawing of straight lines

### Changed

- API entrypoint for "drawing_mode" is now of type string

## [0.1.1] - 2020-07-14

- Disable Retina scaling

## [0.1.0] - 2020-07-06

- Drawable canvas widget
