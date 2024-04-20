import axiosClient from ".";

export const commentApi = {
  getComments: () => axiosClient.get("/comments"),
  createComment: (comment) => axiosClient.post("/comments", comment),
  deleteComment: (commentId) => axiosClient.delete(`/comments/${commentId}`),
  getComment: (id) => axiosClient.put(`/comments/${id}`),
  unlikeComment: (commentId) =>
    axiosClient.put(`/comments/${commentId}/unlike`),
};
