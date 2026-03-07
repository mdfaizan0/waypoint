import axios from "axios";
import { ENV } from "./env";

const api = axios.create({
    baseURL: ENV.API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Module-level token getter; set once by AuthProvider on mount
let _getToken = null;

export function setTokenGetter(getToken) {
    _getToken = getToken;
}

import { toast } from "sonner";

// Request interceptor — attaches Clerk JWT to every outgoing request
api.interceptors.request.use(async (config) => {
    if (_getToken) {
        const token = await _getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Response interceptor — handles toasts and unauthorized errors
api.interceptors.response.use(
    (response) => {
        const { config } = response;

        if (config.showToast && response.data?.success && response.data?.message) {
            toast.success(response.data.message);
        }

        return response;
    },
    async (error) => {
        const { config } = error;

        if (error.response?.status === 401) {
            const requestUrl = error.config?.url || "";
            console.error("Unauthorized request:", requestUrl);

            // Only fire the go-offline call for non-auth endpoints
            // to avoid cascading on the initial profile fetch
            if (!requestUrl.includes("/users/me") && _getToken) {
                try {
                    const token = await _getToken();
                    const baseUrl = ENV.API_BASE_URL;
                    fetch(`${baseUrl}/api/driver/go-offline`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    }).catch(() => { });
                } catch (_) { /* token getter failed, skip */ }
            }
        }

        const shouldSkip = config?.skipToast;
        if (!shouldSkip) {
            const message = error.response?.data?.message || "Something went wrong";
            toast.error(message);
        }

        return Promise.reject(error);
    }
);

export default api;
