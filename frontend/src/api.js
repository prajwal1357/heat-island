import axios from "axios";

const BASE = import.meta.env.VITE_BASE_URL || "http://127.0.0.1:8000";

export const getGrid = () => axios.get(`${BASE}/grid`);
export const refreshWeather = () => axios.post(`${BASE}/refresh-weather`);
export const predict = (data) => axios.post(`${BASE}/predict`, data);
export const getScenarios = () => axios.post(`${BASE}/scenarios`);
