import React, {
  createContext,
  useReducer,
  useContext,
  useCallback,
} from "react"
import { isEmpty, isEqual } from "lodash"

const HISTORY_MAX_COUNT = 100

export interface CanvasState {
  undoStack: Object[]
  redoStack: Object[]
  shouldReloadCanvas: boolean
  initialState: Object
  currentState: Object
}

interface Action {
  type: "save" | "undo" | "redo" | "reset"
  state?: Object
}

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
 * For undo/redo/reset, set shouldReloadCanvas to inject currentState into user facing canvas
 */
const canvasStateReducer = (
  state: CanvasState,
  action: Action
): CanvasState => {
  switch (action.type) {
    case "save":
      if (!action.state) throw new Error("No action state to save")
      else if (isEmpty(state.currentState)) {
        return {
          undoStack: [],
          redoStack: [],
          shouldReloadCanvas: false,
          initialState: action.state,
          currentState: action.state,
        }
      } else if (isEqual(action.state, state.currentState))
        return { ...state, shouldReloadCanvas: false }
      else {
        const undoOverHistoryMaxCount =
          state.undoStack.length >= HISTORY_MAX_COUNT
        const res = {
          undoStack: [
            ...state.undoStack.slice(undoOverHistoryMaxCount ? 1 : 0),
            state.currentState,
          ],
          redoStack: [],
          shouldReloadCanvas: false,
          initialState:
            state.initialState == null
              ? state.currentState
              : state.initialState,
          currentState: action.state,
        }
        return res
      }
    case "undo":
      if (
        isEmpty(state.currentState) ||
        isEqual(state.initialState, state.currentState)
      ) {
        return { ...state, shouldReloadCanvas: false }
      } else {
        const isUndoEmpty = state.undoStack.length === 0
        const res = {
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, state.currentState],
          shouldReloadCanvas: true,
          initialState: state.initialState,
          currentState: isUndoEmpty
            ? state.currentState
            : state.undoStack[state.undoStack.length - 1],
        }
        return res
      }
    case "redo":
      if (state.redoStack.length > 0) {
        // TODO: test currentState empty too ?
        const res = {
          undoStack: [...state.undoStack, state.currentState],
          redoStack: state.redoStack.slice(0, -1),
          shouldReloadCanvas: true,
          initialState: state.initialState,
          currentState: state.redoStack[state.redoStack.length - 1],
        }
        return res
      } else {
        return { ...state, shouldReloadCanvas: false }
      }
    case "reset":
      if (!action.state) throw new Error("No action state to store in reset")
      return {
        undoStack: [],
        redoStack: [],
        shouldReloadCanvas: true,
        initialState: action.state,
        currentState: action.state,
      }
    default:
      throw new Error()
  }
}

const initialState: CanvasState = {
  undoStack: [],
  redoStack: [],
  shouldReloadCanvas: false,
  initialState: {},
  currentState: {},
}

interface CanvasStateContextProps {
  canvasState: CanvasState
  saveState: (state: Object) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  resetState: (state: Object) => void
}

const CanvasStateContext = createContext<CanvasStateContextProps>(
  {} as CanvasStateContextProps
)

export const CanvasStateProvider = ({
  children,
}: React.PropsWithChildren<{}>) => {
  const [canvasState, dispatch] = useReducer(canvasStateReducer, initialState)

  // Setup our callback functions
  // We memoize with useCallback to prevent unnecessary re-renders
  const saveState = useCallback(
    (state) => dispatch({ type: "save", state: state }),
    [dispatch]
  )
  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch])
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch])
  const resetState = useCallback(
    (state) => dispatch({ type: "reset", state: state }),
    [dispatch]
  )

  const canUndo = canvasState.undoStack.length !== 0
  const canRedo = canvasState.redoStack.length !== 0

  return (
    <CanvasStateContext.Provider
      value={{
        canvasState,
        saveState,
        undo,
        redo,
        canUndo,
        canRedo,
        resetState,
      }}
    >
      {children}
    </CanvasStateContext.Provider>
  )
}

/**
 * Hook to get data out of context
 */
export const useCanvasState = () => {
  return useContext(CanvasStateContext)
}
