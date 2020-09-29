import React from "react"

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
    style={{
      transform: invertX ? "scaleX(1)" : "scaleX(-1)",
      cursor: "pointer",
    }}
    alt={altText}
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
  const GAP_BETWEEN_ICONS = 2
  const ICON_SIZE = 16

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
      altText: "Reset",
      invertX: false,
      clickCallback: resetCallback,
    },
  ]

  return (
    <div
      style={{
        top: topPosition + 3,
        left: leftPosition - 3 * ICON_SIZE,
        zIndex: 20,
        position: "absolute",
        display: "flex",
        gap: GAP_BETWEEN_ICONS,
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
