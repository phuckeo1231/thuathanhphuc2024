import axios from "axios";

export const baseURL = "https://jsonplaceholder.typicode.com";

const axiosClient = axios.create({
  baseURL: baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosClient.interceptors.request.use((config) => {
  return config;
});

axiosClient.interceptors.response.use((response) => {
  if (response && response.data) return response.data;
  return response;
});

export default axiosClient;
