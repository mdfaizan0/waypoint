import { supabase } from "../config/supabase.js";

export async function getMe(req, res) {
    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", req.user.id)
            .single()

        if (userError) {
            console.error("Error fetching user:", userError);
            return res.status(500).json({ success: false, message: "Failed to fetch user" });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        return res.status(200).json({ success: true, user })
    } catch (error) {
        console.error("Error fetching user:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch user" });
    }
}