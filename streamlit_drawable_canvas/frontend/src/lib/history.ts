import { useReducer } from "react"
import { isEqual } from "lodash"

const HISTORY_MAX_COUNT = 100

interface History {
  undoStack: Array<Object>
  redoStack: Array<Object>
  currentState?: Object
}

interface Action {
  type: "save" | "undo" | "redo" | "reset"
  state?: Object
}

const useHistory = () => {
  const historyReducer = (history: History, action: Action) => {
    switch (action.type) {
      case "save":
        if (isEqual(history.currentState, action.state)) return history
        history.redoStack = []
        if (history.currentState) {
          history.undoStack.push(history.currentState)
        }
        if (history.undoStack.length >= HISTORY_MAX_COUNT) {
          history.undoStack.shift()
        }
        history.currentState = action.state
        return history
      case "undo":
        if (history.currentState) {
          history.redoStack.push(history.currentState)
          if (history.undoStack.length === 0) history.currentState = undefined
        }
        if (history.undoStack.length > 0) {
          const previousState = history.undoStack.pop()
          history.currentState = previousState
          return history
        }
        return history
      case "redo":
        if (history.redoStack.length > 0) {
          if (history.currentState) history.undoStack.push(history.currentState)
          const previousState = history.redoStack.pop()
          history.currentState = previousState
          return history
        }
        return history
      case "reset":
        return { undoStack: [], redoStack: [], currentState: action.state }
      default:
        throw new Error()
    }
  }

  const [history, dispatchHistory] = useReducer(historyReducer, {
    undoStack: [],
    redoStack: [],
    currentState: undefined,
  })

  return { history, dispatchHistory }
}

export default useHistory
