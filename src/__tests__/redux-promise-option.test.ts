import {
  promiseOptionMiddleware,
  PromiseOptionState,
  OnTransitionParams,
  PromiseAction,
  OutActionTypes,
  PromisedStateAction
} from '../redux-promise-option'
import waitUntil from 'async-wait-until'
import { AnyAction, Dispatch, Action, MiddlewareAPI } from 'redux'
import { createStandardAction, ActionType } from 'typesafe-actions'

const standardPayloadAction = createStandardAction('SOME_TYPE')<string>()
type StandardPayloadActionType = ActionType<typeof standardPayloadAction>

interface IPromiseOption extends PromiseAction<string> {
  type: 'PROMISE_TYPE'
  promise: Promise<string>
}

type RootAction = StandardPayloadActionType | IPromiseOption

describe('redux-promise-option', () => {
  it('should not mutate action w/o a promise', () => {
    const action = standardPayloadAction('some_payload')

    runMiddleware(action)

    expect(actionToNext).toEqual(action)
  })

  it('should throw an exception if "promise" is not a promise', () => {
    const action: any = {
      type: 'SOME_TYPE',
      promise: 'not-a-promise'
    }

    expect(() =>
      promiseOptionMiddleware(mockStore)(mockNext)(action)
    ).toThrowErrorMatchingSnapshot()
  })

  it('should throw an exception if both payload and promise exist in action', () => {
    // Todo, use type diff to make this a compiler error.
    const action: any = {
      type: 'SOME_TYPE',
      payload: 'SOME_PAYLOAD',
      promise: new Promise(() => false)
    }

    expect(() => runMiddleware(action)).toThrowError()
  })

  it('should dispatch an initial Running action', () => {
    const action: IPromiseOption = {
      type: 'PROMISE_TYPE',
      promise: new Promise<string>(() => null)
    }

    runMiddleware(action)

    validateRunningActionDispatched()
  })

  it('should dispatch a failed action', async () => {
    const action: IPromiseOption = {
      type: 'PROMISE_TYPE',
      promise: new Promise((resolve, reject) => reject('It went bad'))
    }

    runMiddleware(action)

    await waitUntil(() => dispatchedActions.length === 1, 100)

    dispatchedActions[0].promisedState.onTransition(onTransitionArgs)
    expect(onFailed).toHaveBeenCalledTimes(1)
    expect(onFinished).toHaveBeenCalledTimes(0)
    expect(onRunning).toHaveBeenCalledTimes(0)
  })

  it('should dispatch a success action', async () => {
    const action: IPromiseOption = {
      type: 'PROMISE_TYPE',
      promise: new Promise(resolve => resolve('it went well'))
    }

    runMiddleware(action)

    await waitUntil(() => dispatchedActions.length === 1, 100)
    dispatchedActions[0].promisedState.onTransition(onTransitionArgs)
    expect(dispatchedActions[0].promisedState.unsafeResult).toEqual('it went well')
    expect(onFailed).toHaveBeenCalledTimes(0)
    expect(onFinished).toHaveBeenCalledTimes(1)
    expect(onRunning).toHaveBeenCalledTimes(0)
  })

  // Mocks & Helpers

  const validateRunningActionDispatched = () => {
    expect(actionToNext).toMatchObject({
      type: 'PROMISE_TYPE',
      promisedState: {
        unsafeResult: null,
        state: PromiseOptionState.Running
      }
    })

    ;(actionToNext as PromisedStateAction<string>).promisedState.onTransition(onTransitionArgs)
    expect(onFailed).toHaveBeenCalledTimes(0)
    expect(onFinished).toHaveBeenCalledTimes(0)
    expect(onRunning).toHaveBeenCalledTimes(1)
  }

  let actionToNext: OutActionTypes<string> | undefined
  let dispatchedActions: any[] = []
  const mockStore: MiddlewareAPI = {
    dispatch: <A extends Action = AnyAction>(action: A) => {
      dispatchedActions.push(action)
      return action
    },
    getState: () => {
      throw new Error('not implemented')
    }
  }

  let onRunning: () => {}
  let onFinished: () => {}
  let onFailed: () => {}
  let onTransitionArgs: OnTransitionParams<any, any>

  const mockNext: Dispatch<Action> = <A extends Action = AnyAction>(action: A) => {
    actionToNext = action
    return action
  }

  beforeEach(() => {
    dispatchedActions = []
    actionToNext = undefined
    onRunning = jest.fn()
    onFinished = jest.fn()
    onFailed = jest.fn()
    onTransitionArgs = {
      running: onRunning,
      failed: onFailed,
      finished: onFinished
    }
  })

  const runMiddleware = (action: RootAction) => {
    promiseOptionMiddleware(mockStore)(mockNext)(action)
  }
})