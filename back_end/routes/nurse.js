const express = require("express");
const router = express.Router();
const Patient = require("../models/Patient");
const Vitals = require("../models/Vitals");

router.get("/patients/:nurseId", async (req,res) => {
    const patients = await Patient.find({ nurse_id: req.params.nurseId });
    res.json(patients);
});

router.post("/update-vitals", async (req,res) => {
    const vitals = new Vitals(req.body);
    await vitals.save();
    res.json({ message: "Vitals updated successfully" });
});

module.exports = router;
