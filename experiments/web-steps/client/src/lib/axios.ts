import axios from "axios";
import { env } from "../env";

export const axiosInstance = axios.create({
  baseURL: env.VITE_SERVER_URL,
  timeout: 10000,
});
