const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    fullname: String,
    email: String,
    username: String,
    password: String,
    role: String,
    
    assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
},
assignedNurse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
}

});

module.exports = mongoose.model("User", userSchema);
