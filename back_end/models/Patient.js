const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
    name: String,
    age: Number,
    gender: String,
    doctor_id: mongoose.Schema.Types.ObjectId,
    nurse_id: mongoose.Schema.Types.ObjectId
});

module.exports = mongoose.model("Patient", patientSchema);
