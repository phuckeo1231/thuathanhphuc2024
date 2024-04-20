import createSagaMiddleware from "redux-saga";
import { applyMiddleware, combineReducers, createStore } from "redux";
import postReducer from "./redux/reducers/postsReducer";
import postSaga from "./redux/saga/postSage";
import userReducer from "./redux/reducers/userReducer";
import { userSaga } from "./redux/saga/userSaga";
import { all } from "redux-saga/effects";
import commentReducer from "./redux/reducers/commentReducer";

const sagaMiddleware = createSagaMiddleware();

export const rootReducer = combineReducers({
  posts: postReducer,
  user: userReducer,
  comments: commentReducer,
});

function* rootSaga() {
  yield all([postSaga(), userSaga()]);
}

export const store = createStore(rootReducer, applyMiddleware(sagaMiddleware));

sagaMiddleware.run(rootSaga);
