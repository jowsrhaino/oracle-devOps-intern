const mongoose = require("mongoose");



const vitalsSchema = new mongoose.Schema({
    patient_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    heart_rate: Number,
    temperature: Number,
    oxygen: Number,
    status: String,

    ecg: [Number],   // 🔥 ECG waveform data

    recorded_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Vitals", vitalsSchema);

