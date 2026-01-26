const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const User = require("./models/User");
const router = express.Router();
const app = express();
const session = require("express-session");
const client = require("prom-client");
app.use(session({
    secret: "your-secret-key",  // எந்தவொரு secret key
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24*60*60*1000 } // 1 day
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // body-parser not needed (modern Express)


async function ensureAdmin() {
    try {
        const existingAdmin = await User.findOne({ role: "Admin" });
        if (!existingAdmin) {
            const admin = new User({
                fullname: "Admin",
                email: "admin@gmail.com",
                username: "admin",
                password: "admin123",
                role: "Admin"
            });
            await admin.save();
            console.log("✅ Admin created automatically");
        } else {
            console.log("Admin already exists ✅");
        }
    } catch (err) {
        console.error("Error checking/creating admin:", err);
    }
}
// MongoDB connection
mongoose.connect("mongodb://mongo:27017/livepatient")
  .then(() => {
      console.log("✅ MongoDB Connected");
      ensureAdmin();
  })
  .catch(err => console.log("❌ MongoDB connection error:", err));



// Serve frontend files
app.use(express.static(path.join(__dirname, "../front_end/")));



// Home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../front_end/home.html"));
    
});



app.get("/register", (req, res) => {
    res.sendFile("register.html", { root: path.join(__dirname, "../front_end/") });
});

app.post("/register", async (req, res) => {
    try {
        const { fullname, email, username, password, confirmPassword, role } = req.body;

        if (password !== confirmPassword) {
            return res.send(`
                <script>
                    alert("Passwords do not match");
                    window.history.back();
                </script>
            `);
        }

        const newUser = new User({
            fullname,
            email,
            username,
            password,
            role
        });

        await newUser.save();

        // ✅ Alert + redirect to home page
        res.send(`
            <script>
                alert("Registration successful!");
                window.location.href = "/home.html";
            </script>
        `);

    } catch (err) {
        console.error(err);
        res.send(`
            <script>
                alert("Registration failed!");
                window.history.back();
            </script>
        `);
    }
});

app.get("/login", (req, res) => {
    res.sendFile("login.html", { root: path.join(__dirname, "../front_end/") });
});

app.post("/login", async (req, res) => {
    try {
        let { username, password, role } = req.body;

        username = username.trim();
        password = password.trim();
        role = role.trim();

        const user = await User.findOne({
            $or: [{ username }, { email: username }],
            role: role
        });

        if (!user) {
            return res.send(`
                <script>
                    alert("User not found / Role mismatch");
                    window.history.back();
                </script>
            `);
        }

        if (String(user.password) !== String(password)) {
            return res.send(`
                <script>
                    alert("Invalid password");
                    window.history.back();
                </script>
            `);
        }

        req.session.userId = user._id;
        req.session.role = user.role;

        let redirectPage = "/index.html";

        if (user.role === "Admin") redirectPage = "/admin";
        else if (user.role === "Doctor") redirectPage = "/doctor_dashboard.html";
        else if (user.role === "Nurse") redirectPage = "/nurse_dashboard.html";
        else if (user.role === "Patient") redirectPage = "/patient_dashboard.html";

        res.send(`
            <script>
                alert("Login successful");
                window.location.href = "${redirectPage}";
            </script>
        `);

    } catch (err) {
        console.error(err);
        res.send(`
            <script>
                alert("Login failed");
                window.history.back();
            </script>
        `);
    }
});

app.get("/patient/dashboard", async (req, res) => {

    if (!req.session.userId || req.session.role !== "Patient") {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const patientId = req.session.userId;

    const patient = await User.findById(patientId);
    const vitals = await Vitals.findOne({ patient_id: patientId })
        .sort({ recorded_at: -1 });

    if (!patient || !vitals)
        return res.json({ error: "No data" });

    res.json({
        name: patient.username,
        age: patient.age,
        gender: patient.gender,
        heart_rate: vitals.heart_rate,
        temperature: vitals.temperature,
        oxygen: vitals.oxygen,
        status: vitals.status
    });
});
app.get("/doctor/reports/:patientId", async (req, res) => {
    try {
        const patientId = req.params.patientId;

        // latest 10 vitals for that patient
        const vitalsData = await Vitals.find({ patient_id: patientId })
            .sort({ recorded_at: 1 })   // oldest → newest
            .limit(10);

        if (!vitalsData || vitalsData.length === 0) {
            return res.json({
                timestamps: [],
                heart_rate: [],
                temperature: [],
                oxygen: []
            });
        }

        const timestamps = vitalsData.map(v => v.recorded_at.toLocaleTimeString());
        const heart_rate = vitalsData.map(v => v.heart_rate);
        const temperature = vitalsData.map(v => v.temperature);
        const oxygen = vitalsData.map(v => v.oxygen);

        res.json({ timestamps, heart_rate, temperature, oxygen });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch report data" });
    }
});


// ================= Doctor Assigned Patients =================
router.get("/doctor/assigned-patients", async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== "Doctor") {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const patients = await User.find({
            role: "Patient",
            assignedDoctor: req.session.userId
        });

        res.json(patients.map(p => ({
            id: p._id,
            name: p.fullname
        })));

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load assigned patients" });
    }
});
// ================= Patient Reports =================
router.get("/doctor/reports/:patientId", async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== "Doctor") {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { patientId } = req.params;

        // check assignment
        const patient = await User.findOne({
            _id: patientId,
            assignedDoctor: req.session.userId
        });

        if (!patient) {
            return res.status(403).json({ message: "Patient not assigned" });
        }

        const vitals = await Vitals.find({ patient_id: patientId })
            .sort({ recorded_at: 1 })
            .limit(50);

        res.json({
            timestamps: vitals.map(v =>
                new Date(v.recorded_at).toLocaleTimeString()
            ),
            heart_rate: vitals.map(v => v.heart_rate),
            temperature: vitals.map(v => v.temperature),
            oxygen: vitals.map(v => v.oxygen)
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load reports" });
    }
});








app.get("/contact", (req, res) => {
    res.sendFile("contact.html", { root: path.join(__dirname, "../front_end/") });
});

app.get("/admin", (req, res) => {
    res.sendFile("admin_dashboard.html", { root: path.join(__dirname, "../front_end/") });
});

// Get counts for admin dashboard
app.get("/admin/user-counts", async (req, res) => {
    try {
        const totalPatients = await User.countDocuments({ role: "Patient" });
        const totalDoctors  = await User.countDocuments({ role: "Doctor" });
        const totalNurses   = await User.countDocuments({ role: "Nurse" });

        res.json({
            patients: totalPatients,
            doctors: totalDoctors,
            nurses: totalNurses
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch counts" });
    }
});



app.get("/admin/users", (req, res) => {
    res.sendFile(path.join(__dirname, "../front_end/manage_users.html"));
});

// API – Get all users as JSON
app.get("/admin/users/data", async (req, res) => {
    try {
        const users = await User.find();
        const result = users.map(u => ({
            id: u._id,
            name: u.fullname,
            email: u.email,
            role: u.role
        }));
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load users" });
    }
});

// API – Get single user
app.get("/admin/user/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            id: user._id,
            name: user.fullname,
            email: user.email,
            role: user.role
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching user" });
    }
});

// API – Add user
app.post("/admin/user/add", async (req, res) => {
    try {
        const { name, email, role, password } = req.body;

        const newUser = new User({
            fullname: name,
            email,
            username: email.split("@")[0],
            password,
            role
        });

        await newUser.save();
        res.json({ message: "User added successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to add user" });
    }
});

// API – Update user
app.post("/admin/user/update/:id", async (req, res) => {
    try {
        const { name, email, role, password } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.fullname = name;
        user.email = email;
        user.role = role;
        if (password) user.password = password;

        await user.save();
        res.json({ message: "User updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update user" });
    }
});

// API – Delete user
app.delete("/admin/user/delete/:id", async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete user" });
    }
});

app.get("/admin/profile", (req, res) => { 
    res.sendFile(path.join(__dirname, "../front_end/profile.html"));
});

// Get current logged-in user (from session or JWT)
app.get("/admin/profile/me", async (req, res) => {
    try {
        const userId = req.session.userId; // or from JWT
        const user = await User.findById(userId);
        if(!user) return res.status(404).json({message: "User not found"});

        res.json({
            id: user._id,
            name: user.fullname,
            email: user.email,
            role: user.role
        });
    } catch(err) {
        console.error(err);
        res.status(500).json({message: "Failed to fetch profile"});
    }
});

// Update profile
app.post("/profile/update/:id", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const user = await User.findById(req.params.id);
        if(!user) return res.status(404).json({message: "User not found"});

        user.fullname = name;
        user.email = email;
        if(password) user.password = password;

        await user.save();
        res.json({message: "Profile updated successfully"});
    } catch(err) {
        console.error(err);
        res.status(500).json({message: "Failed to update profile"});
    }
});




// ------------------- Get all patients -------------------
router.get("/admin/patients", async (req, res) => {
    try {
        const patients = await User.find({
            role: "Patient",
            assignedDoctor: null,
            assignedNurse: null
        });

        res.json(patients.map(p => ({
            id: p._id,
            name: p.fullname
        })));
    } catch (err) {
        res.status(500).json({ message: "Patients load ஆகவில்லை" });
    }
});


// ------------------- Get all doctors -------------------
router.get("/admin/doctors", async (req,res) => {
    try {
        const doctors = await User.find({role:"Doctor"});
        res.json(doctors.map(d=>({id:d._id,name:d.fullname,email:d.email})));
    } catch(err) {
        console.error(err);
        res.status(500).json({message:"Failed to load doctors"});
    }
});

// ------------------- Get all nurses -------------------
router.get("/admin/nurses", async (req,res) => {
    try {
        const nurses = await User.find({role:"Nurse"});
        res.json(nurses.map(n=>({id:n._id,name:n.fullname,email:n.email})));
    } catch(err) {
        console.error(err);
        res.status(500).json({message:"Failed to load nurses"});
    }
});

// ------------------- Assign doctor/nurse to patient -------------------
router.post("/admin/assign", async (req,res) => {
    try {
        const { patientId, doctorId, nurseId } = req.body;
        const patient = await User.findById(patientId);
        if(!patient || patient.role!=="Patient") return res.status(404).json({message:"Patient not found"});

        patient.assignedDoctor = doctorId || null;
        patient.assignedNurse = nurseId || null;
        await patient.save();

        res.json({message:"Patient assigned successfully"});
    } catch(err) {
        console.error(err);
        res.status(500).json({message:"Failed to assign patient"});
    }
});

app.get("/admin/assign", (req, res) => {
    res.sendFile(path.join(__dirname, "../front_end/assign_staff.html"));
});

app.get("/doctor_dashboard",(req,res)=>{
    res.sendFile(path.join(__dirname,"../front_end/doctor_dashboard.html"));
})

app.get("/doctor/live_monitoring",(req, res)=>{
    res.sendFile(path.join(__dirname,"../front_end/live_monitoring.html"));
});

app.get("/doctor/my-patients", async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== "Doctor") {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const patients = await User.find({
            role: "Patient",
            assignedDoctor: req.session.userId
        });

        const result = [];

        for (let p of patients) {
            const vitals = await Vitals.findOne({ patient_id: p._id })
                .sort({ recorded_at: -1 });

            result.push({
                id: p._id,
                name: p.fullname,
                age: p.age || "--",
                gender: p.gender || "--",
                heart_rate: vitals?.heart_rate || "--",
                temperature: vitals?.temperature || "--",
                oxygen: vitals?.oxygen || "--",
                status: vitals?.status || "Normal"
            });
        }

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load patients" });
    }
});









const Vitals = require("./models/Vitals");

router.get("/doctor/patients", async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== "Doctor") {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const patients = await User.find({
            role: "Patient",
            assignedDoctor: req.session.userId
        });

        res.json(patients.map(p => ({
            id: p._id,
            name: p.fullname,
            age: p.age || "--",
            gender: p.gender || "--"
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load patients" });
    }
});

// ---------------- Get latest vitals for a patient ----------------
router.get("/live-vitals/:patientId", async (req, res) => {
    try {
        const { patientId } = req.params;
        const vitals = await Vitals.findOne({ patient_id: patientId }).sort({ recorded_at: -1 });

        if (!vitals) return res.json({
            heart_rate: 0,
            temperature: 0,
            oxygen: 0,
            status: "No data",
            ecg: Array(25).fill(0)
        });

        res.json({
            heart_rate: vitals.heart_rate,
            temperature: vitals.temperature,
            oxygen: vitals.oxygen,
            status: vitals.status || "Normal",
            ecg: vitals.ecg || Array(25).fill(0)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch vitals" });
    }
});

// ---------------- Optional: Simulate live data every second ----------------
function generateECGData(length = 50) {
    const data = [];
    for (let i = 0; i < length; i++) {
        const t = i / length * 2 * Math.PI;
        let value = Math.sin(2 * t) * 10;   // base sine wave
        value += (Math.random() - 0.5) * 3; // small noise
        if (i % 10 === 5) value += 25;      // simulate R peak
        data.push(Math.floor(50 + value));  // shift to ~50-70 range
    }
    return data;
}
function generateECG() {
    const ecg = [];
    for (let i = 0; i < 40; i++) {
        let value = 60;

        if (i === 5) value = 70;     // P
        if (i === 10) value = 40;    // Q
        if (i === 11) value = 120;   // R
        if (i === 12) value = 35;    // S
        if (i === 20) value = 75;    // T

        value += Math.random() * 4 - 2;
        ecg.push(value);
    }
    return ecg;
}


// Update vitals every second
setInterval(async () => {
    const patients = await User.find({ role: "Patient" });

    for (let p of patients) {
        const hr = Math.floor(60 + Math.random() * 30);

        await Vitals.create({
            patient_id: p._id,
            heart_rate: hr,
            temperature: (36 + Math.random()).toFixed(1),
            oxygen: Math.floor(95 + Math.random() * 4),
            status: hr > 100 ? "Critical" : "Normal",
            ecg: generateECG()
        });
    }
}, 1000);


// Route to fetch latest vitals
app.get("/live-vitals/:patientId", async (req, res) => {
    try {
        const vitals = await Vitals.findOne({ patient_id: req.params.patientId })
            .sort({ recorded_at: -1 });
        if (!vitals) return res.json(null);

        res.json(vitals);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch vitals" });
    }
});





app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});



module.exports = router;
app.use(router);

app.get("/doctor/reports",(req,res)=>{
    res.sendFile(path.join(__dirname,"../front_end/reports.html"))
});

app.get("/patient_dashboard",(req,res)=>{
    res.sendFile(path.join(__dirname,"../front_end/patient_dashboard.html"));
});


app.use(router);
// Start server
const PORT = 5000;
app.listen(PORT,'0.0.0.0', () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
