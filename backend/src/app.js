import express from "express"
import cors from "cors"
import rideRouter from "./routes/ride.route.js"
import webhookRoutes from "./routes/webhook.route.js"
import driverRouter from "./routes/driver.route.js"
import userRouter from "./routes/user.route.js"
import { clerkMiddleware } from "@clerk/express"

const app = express()

app.use(cors())
app.use("/webhooks", webhookRoutes)
app.use(express.json())
app.use(clerkMiddleware())

app.get("/", (req, res) => {
    res.send("Where ya heading today? 📍")
})

app.get("/health", (req, res) => {
    res.send("OK")
})

app.use("/api/rides", rideRouter)
app.use("/api/driver", driverRouter)
app.use("/api/users", userRouter)

export default app