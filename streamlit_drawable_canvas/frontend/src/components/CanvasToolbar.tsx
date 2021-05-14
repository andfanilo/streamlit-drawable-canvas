import React from "react"

import styles from "./CanvasToolbar.module.css"

import bin from "../img/bin.png"
import undo from "../img/undo.png"
import download from "../img/download.png"

interface SquareIconProps {
  imgUrl: string
  altText: string
  invertX?: boolean
  size: number
  enabled: boolean
  clickCallback: () => void
}

const SquareIcon = ({
  imgUrl,
  altText,
  invertX,
  size,
  enabled,
  clickCallback,
}: SquareIconProps) => (
  <img
    src={imgUrl}
    className={`
    ${enabled ? styles.enabled : styles.disabled} ${
      invertX ? "" : styles.invertx
    }
    `}
    alt={altText}
    title={altText}
    height={`${size}px`}
    width={`${size}px`}
    onClick={clickCallback}
  />
)
SquareIcon.defaultProps = {
  invertX: false,
}

interface CanvasToolbarProps {
  topPosition: number
  leftPosition: number
  canUndo: boolean
  canRedo: boolean
  downloadCallback: () => void
  undoCallback: () => void
  redoCallback: () => void
  resetCallback: () => void
}

const CanvasToolbar = ({
  topPosition,
  leftPosition,
  canUndo,
  canRedo,
  downloadCallback,
  undoCallback,
  redoCallback,
  resetCallback,
}: CanvasToolbarProps) => {
  const GAP_BETWEEN_ICONS = 4
  const ICON_SIZE = 24

  const iconElements = [
    {
      imgUrl: download,
      altText: "Send to Streamlit",
      invertX: false,
      enabled: true,
      clickCallback: downloadCallback,
    },
    {
      imgUrl: undo,
      altText: "Undo",
      invertX: true,
      enabled: canUndo,
      clickCallback: canUndo ? undoCallback : () => {},
    },
    {
      imgUrl: undo,
      altText: "Redo",
      invertX: false,
      enabled: canRedo,
      clickCallback: canRedo ? redoCallback : () => {},
    },
    {
      imgUrl: bin,
      altText: "Reset canvas & history",
      invertX: false,
      enabled: true,
      clickCallback: resetCallback,
    },
  ]

  return (
    <div
      style={{
        position: "absolute",
        top: topPosition + 4,
        left: 0,
        display: "flex",
        gap: GAP_BETWEEN_ICONS,
        zIndex: 20,
      }}
    >
      {iconElements.map((e) => (
        <SquareIcon
          key={e.altText}
          imgUrl={e.imgUrl}
          altText={e.altText}
          invertX={e.invertX}
          size={ICON_SIZE}
          enabled={e.enabled}
          clickCallback={e.clickCallback}
        />
      ))}
    </div>
  )
}

export default CanvasToolbar
