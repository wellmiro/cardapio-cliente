import axios from "axios";

const URL_SERVER = "https://api-99burger.onrender.com";

const api = axios.create({
    baseURL: URL_SERVER
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;