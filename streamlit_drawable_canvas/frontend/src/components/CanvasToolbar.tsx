import React from "react"

import styles from "./CanvasToolbar.module.css"

import bin from "../img/bin.png"
import undo from "../img/undo.png"

interface SquareIconProps {
  imgUrl: string
  altText: string
  invertX?: boolean
  size: number
  clickCallback: () => void
}

const SquareIcon = ({
  imgUrl,
  altText,
  invertX,
  size,
  clickCallback,
}: SquareIconProps) => (
  <img
    src={imgUrl}
    className={`${styles.icon} ${invertX ? "" : styles.invertx}`}
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
  undoCallback: () => void
  redoCallback: () => void
  resetCallback: () => void
}

const CanvasToolbar = ({
  topPosition,
  leftPosition,
  undoCallback,
  redoCallback,
  resetCallback,
}: CanvasToolbarProps) => {
  const GAP_BETWEEN_ICONS = 4
  const ICON_SIZE = 24

  const iconElements = [
    {
      imgUrl: undo,
      altText: "Undo",
      invertX: true,
      clickCallback: undoCallback,
    },
    {
      imgUrl: undo,
      altText: "Redo",
      invertX: false,
      clickCallback: redoCallback,
    },
    {
      imgUrl: bin,
      altText: "Reset canvas & history",
      invertX: false,
      clickCallback: resetCallback,
    },
  ]

  return (
    <div
      style={{
        position: "absolute",
        top: topPosition + 4,
        left: leftPosition - 3 * ICON_SIZE - 2 * GAP_BETWEEN_ICONS,
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
          clickCallback={e.clickCallback}
        />
      ))}
    </div>
  )
}

export default CanvasToolbar
