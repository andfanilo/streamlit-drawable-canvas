import { useReducer } from "react"
import { isEqual } from "lodash"

const HISTORY_MAX_COUNT = 100

interface History {
  undoStack: Array<Object>
  redoStack: Array<Object>
  initialState?: Object
  currentState?: Object
}

interface Action {
  type: "save" | "undo" | "redo" | "reset"
  state?: Object
}

const useHistory = () => {
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
  const historyReducer = (history: History, action: Action) => {
    switch (action.type) {
      case "save":
        if (!action.state) throw "No action state to save"
        if (history.initialState == null)
          history.initialState = history.currentState
        if (isEqual(action.state, history.currentState)) return history
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
        if (
          history.currentState &&
          !isEqual(history.initialState, history.currentState)
        ) {
          history.redoStack.push(history.currentState)
          if (history.undoStack.length === 0)
            history.currentState = history.initialState
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
        if (!action.state) throw "No action state to store in reset"
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

  const [history, dispatchHistory] = useReducer(historyReducer, {
    undoStack: [],
    redoStack: [],
    initialState: undefined,
    currentState: undefined,
  })

  return { history, dispatchHistory }
}

export default useHistory
