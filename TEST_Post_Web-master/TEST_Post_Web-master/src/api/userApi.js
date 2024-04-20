import axiosClient from ".";

export const userApi = {
  getUsers: () => axiosClient.get("/users"),
  getUser: (id) => axiosClient.get(`/users/${id}`),
  createUser: (user) => axiosClient.post("/users", user),
  updateUser: (id, user) => axiosClient.put(`/users/${id}`, user),
  deleteUser: (id) => axiosClient.delete(`/users/${id}`),
};
