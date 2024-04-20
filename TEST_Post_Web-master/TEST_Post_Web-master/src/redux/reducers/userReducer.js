import { GET_USER, GET_USER_FAILED } from "../../constant";

const userReducer = (
  state = {
    user: null,
  },
  action
) => {
  switch (action.type) {
    case GET_USER:
      return {
        ...state,
        user: action.payload,
      };
    case GET_USER_FAILED:
      return {
        ...state,
        user: null,
      };

    default:
      return state;
  }
};

export default userReducer;
