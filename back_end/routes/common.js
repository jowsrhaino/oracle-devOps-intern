const express = require("express");
const router = express.Router();
const Patient = require("../models/Patient");

router.get("/patients", async (req,res) => {
    const patients = await Patient.find({}, "name");
    res.json(patients);
});

module.exports = router;
