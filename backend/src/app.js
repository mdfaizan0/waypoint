import express from "express"
import cors from "cors"
import rideRouter from "./routes/ride.route.js"
import webhookRoutes from "./routes/webhook.route.js"

const app = express()

app.use(cors())
app.use("/webhooks", webhookRoutes)
app.use(express.json())

app.get("/", (req, res) => {
    res.send("Where ya heading today? 📍")
})

app.get("/health", (req, res) => {
    res.send("OK")
})

app.use("/api/rides", rideRouter)

export default app