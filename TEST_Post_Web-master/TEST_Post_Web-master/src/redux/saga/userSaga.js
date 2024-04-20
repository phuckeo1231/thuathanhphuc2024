import { call, put, takeEvery } from "redux-saga/effects";
import { userApi } from "../../api/userApi";
import { GET_USER } from "../../constant";

function* fetchUser(action) {
  try {
    const user = yield call(userApi.getUser, action.payload);
    yield put({
      type: "GET_USER",
      payload: user,
    });
  } catch (error) {
    console.log(error);
    yield put({
      type: "GET_USER_FAILED",
      payload: error,
    });
  }
}

export function* userSaga() {
  yield takeEvery(GET_USER, fetchUser);
}
