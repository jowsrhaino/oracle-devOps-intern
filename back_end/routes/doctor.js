const express = require("express");
const router = express.Router();
const Patient = require("../models/Patient");
const Vitals = require("../models/Vitals");

router.get("/patients/:doctorId", async (req,res) => {
    const patients = await Patient.find({ doctor_id: req.params.doctorId });
    const data = [];

    for (let p of patients) {
        const v = await Vitals.find({ patient_id: p._id })
            .sort({ recorded_at: -1 }).limit(1);

        data.push({
            name: p.name,
            age: p.age,
            gender: p.gender,
            heart_rate: v[0]?.heart_rate || "--",
            temperature: v[0]?.temperature || "--",
            oxygen: v[0]?.oxygen || "--",
            status: v[0]?.status || "Normal"
        });
    }
    res.json(data);
});

module.exports = router;
