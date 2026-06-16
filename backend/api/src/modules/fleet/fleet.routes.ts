import { Router } from "express";
import * as fleetCtrl from "./fleet.controller.js";
import * as driverCtrl from "./driver.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { fleetSSEHandler } from "./fleet.sse.js";

const router = Router();

// SSE stream
router.get("/live", fleetSSEHandler);

// Fleet status summary
router.get("/status", requireAuth, fleetCtrl.getFleetStatus);

// Truck CRUD
router.get("/trucks", requireAuth, fleetCtrl.listTrucks);
router.get("/trucks/:id", requireAuth, fleetCtrl.getTruckById);
router.patch("/trucks/:id/location", requireAuth, fleetCtrl.updateLocation);
router.post("/trucks/assign", requireAuth, fleetCtrl.assignTruck);

// Task suggestions & manual dispatch
router.get("/suggestions", requireAuth, fleetCtrl.getTaskSuggestionsHandler);
router.post("/dispatch", requireAuth, fleetCtrl.dispatchManualHandler);

// Driver workflow (specific routes FIRST, before wildcard :id)
router.get("/driver/me", requireAuth, driverCtrl.getDriverInfo);
router.get("/driver/assignment", requireAuth, driverCtrl.getAssignment);
router.post("/driver/claim", requireAuth, driverCtrl.claimTruck);
router.post("/driver/release", requireAuth, driverCtrl.releaseTruck);
router.post("/driver/start", requireAuth, driverCtrl.startRoute);
router.post("/driver/arrive", requireAuth, driverCtrl.arriveAtTps);
router.post("/driver/loading", requireAuth, driverCtrl.startLoading);
router.post("/driver/complete", requireAuth, driverCtrl.completeLoading);
router.post("/driver/arrive-hub", requireAuth, driverCtrl.arriveAtHub);
router.post("/driver/unload", requireAuth, driverCtrl.unloadAtHub);

// Driver dashboard (legacy - wildcard LAST)
router.get("/driver/:id", requireAuth, fleetCtrl.getDriverRoute);

export default router;
