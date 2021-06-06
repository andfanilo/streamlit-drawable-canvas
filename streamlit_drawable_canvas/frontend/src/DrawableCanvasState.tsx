import React, {
  createContext,
  useReducer,
  useContext,
  useCallback,
} from "react"
import { isEmpty, isEqual } from "lodash"

const HISTORY_MAX_COUNT = 100

interface CanvasHistory {
  undoStack: Object[] // store previous canvas states
  redoStack: Object[] // store undone canvas states
}

interface CanvasAction {
  shouldReloadCanvas: boolean // reload currentState into app canvas, on undo/redo
  forceSendToStreamlit: boolean // send currentState back to Streamlit
}

const NO_ACTION: CanvasAction = {
  shouldReloadCanvas: false,
  forceSendToStreamlit: false,
}

const RELOAD_CANVAS: CanvasAction = {
  shouldReloadCanvas: true,
  forceSendToStreamlit: false,
}

const SEND_TO_STREAMLIT: CanvasAction = {
  shouldReloadCanvas: false,
  forceSendToStreamlit: true,
}

const RELOAD_AND_SEND_TO_STREAMLIT: CanvasAction = {
  shouldReloadCanvas: true,
  forceSendToStreamlit: true,
}

interface CanvasState {
  history: CanvasHistory
  action: CanvasAction
  initialState: Object // first currentState for app
  currentState: Object // current canvas state as canvas.toJSON()
}

interface Action {
  type: "save" | "undo" | "redo" | "reset" | "forceSendToStreamlit"
  state?: Object
}

/**
 * Reducer takes 5 actions: save, undo, redo, reset, forceSendToStreamlit
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
          history: {
            undoStack: [],
            redoStack: [],
          },
          action: { ...NO_ACTION },
          initialState: action.state,
          currentState: action.state,
        }
      } else if (isEqual(action.state, state.currentState))
        return {
          history: { ...state.history },
          action: { ...NO_ACTION },
          initialState: state.initialState,
          currentState: state.currentState,
        }
      else {
        const undoOverHistoryMaxCount =
          state.history.undoStack.length >= HISTORY_MAX_COUNT
        return {
          history: {
            undoStack: [
              ...state.history.undoStack.slice(undoOverHistoryMaxCount ? 1 : 0),
              state.currentState,
            ],
            redoStack: [],
          },
          action: { ...NO_ACTION },
          initialState:
            state.initialState == null
              ? state.currentState
              : state.initialState,
          currentState: action.state,
        }
      }
    case "undo":
      if (
        isEmpty(state.currentState) ||
        isEqual(state.initialState, state.currentState)
      ) {
        return {
          history: { ...state.history },
          action: { ...NO_ACTION },
          initialState: state.initialState,
          currentState: state.currentState,
        }
      } else {
        const isUndoEmpty = state.history.undoStack.length === 0
        return {
          history: {
            undoStack: state.history.undoStack.slice(0, -1),
            redoStack: [...state.history.redoStack, state.currentState],
          },
          action: { ...RELOAD_CANVAS },
          initialState: state.initialState,
          currentState: isUndoEmpty
            ? state.currentState
            : state.history.undoStack[state.history.undoStack.length - 1],
        }
      }
    case "redo":
      if (state.history.redoStack.length > 0) {
        // TODO: test currentState empty too ?
        return {
          history: {
            undoStack: [...state.history.undoStack, state.currentState],
            redoStack: state.history.redoStack.slice(0, -1),
          },
          action: { ...RELOAD_CANVAS },
          initialState: state.initialState,
          currentState:
            state.history.redoStack[state.history.redoStack.length - 1],
        }
      } else {
        return {
          history: { ...state.history },
          action: { ...NO_ACTION },
          initialState: state.initialState,
          currentState: state.currentState,
        }
      }
    case "reset":
      if (!action.state) throw new Error("No action state to store in reset")
      return {
        history: {
          undoStack: [],
          redoStack: [],
        },
        action: { ...RELOAD_AND_SEND_TO_STREAMLIT },
        initialState: action.state,
        currentState: action.state,
      }
    case "forceSendToStreamlit":
      return {
        history: { ...state.history },
        action: { ...SEND_TO_STREAMLIT },
        initialState: state.initialState,
        currentState: state.currentState,
      }
    default:
      throw new Error("TS should protect from this")
  }
}

const initialState: CanvasState = {
  history: {
    undoStack: [],
    redoStack: [],
  },
  action: {
    forceSendToStreamlit: false,
    shouldReloadCanvas: false,
  },
  initialState: {},
  currentState: {},
}

interface CanvasStateContextProps {
  canvasState: CanvasState
  saveState: (state: Object) => void
  undo: () => void
  redo: () => void
  forceStreamlitUpdate: () => void
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
  const forceStreamlitUpdate = useCallback(
    () => dispatch({ type: "forceSendToStreamlit" }),
    [dispatch]
  )
  const resetState = useCallback(
    (state) => dispatch({ type: "reset", state: state }),
    [dispatch]
  )

  const canUndo = canvasState.history.undoStack.length !== 0
  const canRedo = canvasState.history.redoStack.length !== 0

  return (
    <CanvasStateContext.Provider
      value={{
        canvasState,
        saveState,
        undo,
        redo,
        canUndo,
        canRedo,
        forceStreamlitUpdate,
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
