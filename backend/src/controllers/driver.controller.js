import { supabase } from "../config/supabase.js"

export async function goOnline(req, res) {
    const user_id = req.user.id
    try {
        const { data: driver, error: driverError } = await supabase
            .from("driver_profiles")
            .update({
                is_online: true,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", user_id)
            .eq("is_online", false)
            .select()
            .single()

        if (driverError) {
            console.log("Error updating driver status:", driverError)
            return res.status(500).json({ success: false, message: "Failed to update driver status" })
        }

        if (!driver) {
            return res.status(400).json({ success: false, message: "Driver not found or not offline" })
        }

        return res.status(200).json({ success: true, message: "Driver is now online", driver })
    } catch (error) {
        console.log("Error updating driver status:", error)
        return res.status(500).json({ success: false, message: "Failed to update driver status" })
    }
}

export async function goOffline(req, res) {
    const user_id = req.user.id
    try {
        const { data: activeRide } = await supabase
            .from("rides")
            .select("id")
            .eq("driver_id", user_id)
            .in("status", ["ACCEPTED", "DRIVER_EN_ROUTE", "STARTED"])
            .maybeSingle();

        if (activeRide) {
            return res.status(400).json({ success: false, message: "Driver has an active ride" })
        }

        const { data: driver, error: driverError } = await supabase
            .from("driver_profiles")
            .update({
                is_online: false,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", user_id)
            .eq("is_online", true)
            .select()
            .single()

        if (driverError) {
            console.log("Error updating driver status:", driverError)
            return res.status(500).json({ success: false, message: "Failed to update driver status" })
        }

        if (!driver) {
            return res.status(400).json({ success: false, message: "Driver not found or not online" })
        }

        return res.status(200).json({ success: true, message: "Driver is now offline", driver })
    } catch (error) {
        console.log("Error updating driver status:", error)
        return res.status(500).json({ success: false, message: "Failed to update driver status" })
    }
}

export async function locationUpdate(req, res) {
    const { lng, lat } = req.body
    if (lat === undefined || lng === undefined) {
        return res.status(400).json({ success: false, message: "Latitude and longitude are required" })
    }
    if (lat < -90 || lat > 90) {
        return res.status(400).json({ success: false, message: "Latitude is invalid" })
    }
    if (lng < -180 || lng > 180) {
        return res.status(400).json({ success: false, message: "Longitude is invalid" })
    }
    try {
        const { data: driver, error: driverError } = await supabase
            .from("driver_profiles")
            .update({
                location: `SRID=4326;POINT(${lng} ${lat})`,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", req.user.id)
            .eq("is_online", true)
            .select()
            .single()

        if (driverError) {
            console.log("Error updating driver location:", driverError)
            return res.status(500).json({ success: false, message: "Failed to update driver location" })
        }

        if (!driver) {
            return res.status(400).json({ success: false, message: "Driver not found or not online" })
        }

        return res.status(200).json({ success: true })
    } catch (error) {
        console.log("Error updating driver location:", error)
        return res.status(500).json({ success: false, message: "Failed to update driver location" })
    }
}