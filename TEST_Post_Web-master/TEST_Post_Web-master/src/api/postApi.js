import axiosClient from ".";

export const postApi = {
  getPosts: () => axiosClient.get("/posts"),
  getPost: (id) => axiosClient.get(`/posts/${id}`),
  getPostComment: (id) => axiosClient.get(`/posts/${id}/comments`),
};
