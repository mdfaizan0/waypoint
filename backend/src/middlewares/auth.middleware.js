import { supabase } from "../config/supabase.js"

export const authMiddleware = async (req, res, next) => {
    const { userId } = req.auth
    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
    }
    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single()

        if (userError) {
            console.error("Error in auth middleware:", userError);
            return res.status(500).json({ success: false, message: "Unauthorized" });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        req.user = user
        next()
    } catch (error) {
        console.error("Error in auth middleware:", error)
        return res.status(500).json({ success: false, message: "Authentication failed" })
    }
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