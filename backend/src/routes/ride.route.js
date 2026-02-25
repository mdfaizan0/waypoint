import express from "express"
import * as rideController from '../controllers/ride.controller.js';
import { authMiddleware, isDriver } from "../middlewares/auth.middleware.js";

const router = express.Router()

router.post('/', rideController.createRide);
router.post('/:id/search', rideController.searchRide);
router.post('/:id/accept', authMiddleware, isDriver, rideController.acceptRide);
// router.post('/:id/enroute', rideController.enrouteRide);
// router.post('/:id/start', rideController.startRide);
// router.post('/:id/complete', rideController.completeRide);
// router.post('/:id/cancel', rideController.cancelRide);

export default router;