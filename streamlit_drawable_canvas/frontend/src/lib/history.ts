import { useReducer } from "react"
import { isEmpty, isEqual } from "lodash"

import sendDataToStreamlit from "./streamlit"

const HISTORY_MAX_COUNT = 100

interface History {
  undoStack: Object[]
  redoStack: Object[]
  initialState: Object
  currentState: Object
}

interface Action {
  type: "save" | "undo" | "redo" | "reset"
  state?: Object
  updateStreamlit: boolean
}

const useHistory = (canvas: fabric.Canvas) => {
  /**
   * Reducer takes 4 actions: save, undo, redo, reset
   *
   * On reset, clear everything, set initial and current state to cleared canvas
   *
   * On save:
   * - First, if there is no initial state, set it to current
   *   Since we don't reset history on component initialization
   *   As backgroundColor/image are applied after component init
   *   and wouldn't be stored in initial state
   * - If the sent state is same as current state, then nothing has changed so don't save
   * - Clear redo stack
   * - Push current state to undo stack, delete oldest if necessary
   * - Set new current state
   *
   * On undo:
   * - Push state to redoStack if it's not the initial
   * - Pop state from undoStack into current state
   *
   * On redo:
   * - Pop state from redoStack into current state
   *
   */
  const historyReducer = (history: History, action: Action): History => {
    switch (action.type) {
      case "save":
        if (!action.state) throw new Error("No action state to save")
        else if (isEmpty(history.currentState)) {
          sendDataToStreamlit(canvas)
          return {
            undoStack: [],
            redoStack: [],
            initialState: action.state,
            currentState: action.state,
          }
        } else if (isEqual(action.state, history.currentState))
          return { ...history }
        else {
          const undoOverHistoryMaxCount =
            history.undoStack.length >= HISTORY_MAX_COUNT
          const res = {
            undoStack: [
              ...history.undoStack.slice(undoOverHistoryMaxCount ? 1 : 0),
              history.currentState,
            ],
            redoStack: [],
            initialState:
              history.initialState == null
                ? history.currentState
                : history.initialState,
            currentState: action.state,
          }
          console.log("Before Save ", history)
          console.log("After Save ", res)
          if (action.updateStreamlit) sendDataToStreamlit(canvas)
          return res
        }
      case "undo":
        if (
          isEmpty(history.currentState) ||
          isEqual(history.initialState, history.currentState)
        ) {
          return { ...history }
        } else {
          const isUndoEmpty = history.undoStack.length === 0
          const res = {
            undoStack: history.undoStack.slice(0, -1),
            redoStack: [...history.redoStack, history.currentState],
            initialState: history.initialState,
            currentState: isUndoEmpty
              ? history.currentState
              : history.undoStack.slice(-1),
          }
          console.log("Before Undo ", history)
          console.log("After Undo ", res)
          updateCanvas(res.currentState, action.updateStreamlit)
          return res
        }
      case "redo":
        if (history.redoStack.length > 0) {
          // TODO: test currentState empty too ?
          const res = {
            undoStack: [...history.undoStack, history.currentState],
            redoStack: history.redoStack.slice(0, -1),
            initialState: history.initialState,
            currentState: history.redoStack.slice(-1),
          }
          console.log("Before Redo ", history)
          console.log("After Redo ", res)
          updateCanvas(res.currentState, action.updateStreamlit)
          return res
        } else {
          return { ...history }
        }
      case "reset":
        if (!action.state) throw new Error("No action state to store in reset")
        if (action.updateStreamlit) sendDataToStreamlit(canvas)
        return {
          undoStack: [],
          redoStack: [],
          initialState: action.state,
          currentState: action.state,
        }
      default:
        throw new Error()
    }
  }

  const updateCanvas = (newState: Object, updateStreamlit: boolean) => {
    canvas.loadFromJSON(newState, () => {
      if (updateStreamlit) sendDataToStreamlit(canvas)
    })
  }

  const [history, dispatchHistory] = useReducer(historyReducer, {
    undoStack: [],
    redoStack: [],
    initialState: {},
    currentState: {},
  })

  return { history, dispatchHistory }
}

export default useHistory
