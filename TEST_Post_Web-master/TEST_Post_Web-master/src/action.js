import { ADD_COMMENT, GET_LIST_POST, GET_LIST_POST_SUCCESS } from "./constant";

export const getListPost = (payload) => {
  return {
    type: GET_LIST_POST,
    payload,
  };
};

export const getListPostSuccess = (payload) => {
  return {
    type: GET_LIST_POST_SUCCESS,
    payload,
  };
};

export const addComment = (comment) => ({
  type: ADD_COMMENT,
  payload: comment,
});
