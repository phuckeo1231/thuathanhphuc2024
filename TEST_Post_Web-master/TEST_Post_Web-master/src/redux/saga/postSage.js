import { call, put, takeEvery } from "redux-saga/effects";
import { postApi } from "../../api/postApi";
import {
  GET_LIST_POST,
  POST_FETCH_SUCCEEDED,
  POST_FETCH_FAILED,
} from "../../constant"; // Import GET_LIST_POST constant

function* fetchPost(action) {
  try {
    const posts = yield call(postApi.getPosts, action.payload);
    yield put({ type: POST_FETCH_SUCCEEDED, posts });
  } catch (error) {
    yield put({ type: POST_FETCH_FAILED, error: error.message });
  }
}

function* postSaga() {
  yield takeEvery(GET_LIST_POST, fetchPost);
}

export default postSaga;
