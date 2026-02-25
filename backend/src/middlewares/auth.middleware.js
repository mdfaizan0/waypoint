import { supabase } from "../config/supabase.js"

export const authMiddleware = (req, res, next) => {
    // TODO: Implement auth middleware
    // TEMP DEV MODE
    req.user = {
        id: "driver_1",
        role: "DRIVER"
    };
    next()
}

export const isDriver = (req, res, next) => {
    const { role } = req.user
    if (!["DRIVER", "ADMIN"].includes(role)) {
        return res.status(403).json({ success: false, message: "Only drivers can perform this action" })
    }
    next()
}

export const isAdmin = (req, res, next) => {
    const { role } = req.user
    if (!["ADMIN"].includes(role)) {
        return res.status(403).json({ success: false, message: "Only admins can perform this action" })
    }
    next()
}