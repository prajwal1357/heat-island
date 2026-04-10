import axios from "axios";

const BASE = import.meta.env.VITE_BASE_URL || "http://127.0.0.1:8000"

export const getGrid = () => axios.get(`${BASE}/grid`);
export const simulate = (data) => axios.post(`${BASE}/simulate`, data);
export const getPlan = () => axios.post(`${BASE}/planner`);