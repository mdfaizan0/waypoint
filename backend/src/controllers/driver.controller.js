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
                is_available: false,
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

export async function getDriverEarnings(req, res) {
    const userId = req.user.id

    try {
        const today = new Date()
        const startOfDay = new Date(today.setHours(0, 0, 0, 0))

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { data: rides, error: ridesError } = await supabase
            .from("rides")
            .select("fare, completed_at")
            .eq("driver_id", userId)
            .eq("status", "COMPLETED")
            .eq("payment_status", "PAID")

        if (ridesError) {
            console.log("Error fetching driver earnings:", ridesError)
            return res.status(500).json({ success: false, message: "Failed to fetch driver earnings" })
        }

        if (!rides || rides.length === 0) {
            return res.status(200).json({
                success: true,
                message: "Driver earnings fetched successfully",
                earnings: {
                    total_earnings: 0,
                    today_earnings: 0,
                    month_earnings: 0,
                    total_completed_rides: 0
                },
            })
        }

        const totalCompletedRides = rides.length

        let totalEarnings = 0
        let todayEarnings = 0
        let monthEarnings = 0

        for (let ride of rides) {
            totalEarnings += Number(ride.fare)

            const rideDate = new Date(ride.completed_at)

            if (rideDate >= startOfDay) {
                todayEarnings += Number(ride.fare)
            }

            if (rideDate >= startOfMonth) {
                monthEarnings += Number(ride.fare)
            }
        }

        return res.status(200).json({
            success: true,
            message: "Driver earnings fetched successfully",
            earnings: {
                total_earnings: totalEarnings,
                today_earnings: todayEarnings,
                month_earnings: monthEarnings,
                total_completed_rides: totalCompletedRides
            },
        })
    } catch (error) {
        console.log("Error fetching driver earnings:", error)
        return res.status(500).json({ success: false, message: "Failed to fetch driver earnings" })
    }
}

export async function getDriverProfile(req, res) {
    const userId = req.user.id
    try {
        const { data: driver, error: driverError } = await supabase
            .from("driver_profiles")
            .select("*")
            .eq("user_id", userId)
            .single()

        if (driverError) {
            console.log("Error fetching driver profile:", driverError)
            return res.status(500).json({ success: false, message: "Failed to fetch driver profile" })
        }

        if (!driver) {
            return res.status(404).json({ success: false, message: "Driver not found" })
        }

        return res.status(200).json({ success: true, driver })
    } catch (error) {
        console.log("Error fetching driver profile:", error)
        return res.status(500).json({ success: false, message: "Failed to fetch driver profile" })
    }
}