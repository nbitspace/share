"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const googleCalendarController_1 = require("../controllers/googleCalendarController");
const router = (0, express_1.Router)();
router.post('/create', googleCalendarController_1.createEvent);
router.post('/update', googleCalendarController_1.updateEvent);
router.post('/delete', googleCalendarController_1.deleteEvent);
exports.default = router;
