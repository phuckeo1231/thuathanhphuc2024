import {
  GET_LIST_POST,
  POST_FETCH_FAILED,
  POST_FETCH_SUCCEEDED,
} from "../../constant";

const postReducer = (
  state = {
    posts: [],
    load: false,
  },
  action
) => {
  switch (action.type) {
    case GET_LIST_POST:
      return {
        ...state,
        load: true,
      };
    case POST_FETCH_SUCCEEDED:
      const { posts } = action;
      console.log(action.payload);
      return {
        ...state,
        posts: posts,
        load: false,
      };

    case POST_FETCH_FAILED:
      return {
        ...state,
        posts: [],
        load: false,
      };

    default:
      return state;
  }
};

export default postReducer;
