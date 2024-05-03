const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();
const dotenv = require("dotenv");
const csv = require("csv-parser");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt"); // hash
dotenv.config();
const multer = require("multer");

const TodoTask = require("./models/TodoTask");
const User = require("./models/User");

const upload = multer({ dest: "uploads/" });

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.URI);
  console.log("Connected to db!", process.env.URI);
  app.listen(3100, () => console.log("Server Up and running"));
}

app.set("view engine", "ejs");
app.use("/static", express.static("public"));
app.use("/uploads", express.static("uploads"));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", err);
    res.status(400).send("Error uploading file");
  } else {
    console.error("Unknown error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.route("/").get(async (req, res) => {
  try {
    const tasks = await TodoTask.find({ deleted: false }).sort({
      createdAt: -1,
    });

    let token = null;
    let avatarUrl = null;
    let name = "anonymous"; // Set default name to "anonymous"
    let userId = null; // Define userId variable

    // Check if user is authenticated
    let bearerHeader = req.headers["authorization"];
    if (!bearerHeader) {
      bearerHeader = req.cookies.token;
    }
    if (typeof bearerHeader !== "undefined") {
      const bearerToken = bearerHeader.split(" ")[1];
      jwt.verify(bearerToken, process.env.JWT_SECRET, (err, authData) => {
        if (err) {
          console.error("Token verification error:", err);
          res.status(403).send("Invalid or expired token");
        } else {
          console.log("Token verified successfully:", authData);
          token = bearerToken;
          avatarUrl = authData.avatarUrl;
          name = authData.name;
          userId = authData.id; // Set userId from authData
        }
      });
    } else {
      // Set default avatar URL if user is not signed in
      avatarUrl =
        "https://villagesonmacarthur.com/wp-content/uploads/2020/12/Blank-Avatar.png";
    }

    res.render("login.ejs", {
      todoTasks: tasks,
      token: token,
      avatarUrl: avatarUrl,
      name: name,
      userId: userId, // Pass userId to the template
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/home", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    const tasks = await TodoTask.find({
      userIdentifier: userId,
      deleted: false,
    }).sort({ createdAt: -1 });

    res.render("todo.ejs", {
      todoTasks: tasks,
      token: req.token,
      avatarUrl: user.avatarUrl,
      name: user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/home", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const { filename, buffer, mimetype } = req.file;

    const todoTask = new TodoTask({
      name: req.body.name,
      mainimg: {
        data: buffer,
        contentType: mimetype,
        filename: filename,
      },
      location: req.body.location,
      caption: req.body.caption,
      userIdentifier: userId,
    });

    await todoTask.save();

    const user = await User.findById(userId);
    const avatarUrl = user.avatarUrl;
    const name = user.name;

    const tasks = await TodoTask.find({
      userIdentifier: userId,
      deleted: false,
    });
    console.log("New post added to MongoDB:", todoTask);
    res.render("todo.ejs", {
      todoTasks: tasks,
      token: req.token,
      avatarUrl: avatarUrl,
      name: name,
      filename: filename,
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).send("Error creating task");
  }
});

// === CALL to AUTHENTICATE ===
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).send("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid credentials");
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        avatarUrl: user.avatarUrl,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", "Bearer " + token, { httpOnly: true, secure: true });
    res.redirect("/home");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// === LOG OUT ====
app.get("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, secure: true });
  res.redirect("/public");
});

// === SIGNUP ====
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ email, password: hashedPassword });

    await newUser.save();

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({ token });
  } catch (error) {
    console.error("Error signing up user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/// UPDATE
app
  .route("/edit/:id")
  .get(verifyToken, async (req, res) => {
    try {
      const id = req.params.id;
      const task = await TodoTask.findById(id);

      // Check if the user is authorized
      if (task && task.userIdentifier === req.user.id) {
        res.render("todoEdit.ejs", { task, idTask: id });
      } else {
        res.status(403).send("Unauthorized");
      }
    } catch (err) {
      res.status(500).send(err);
    }
  })
  .post(verifyToken, upload.single("mainimg"), async (req, res) => {
    try {
      const id = req.params.id;
      const task = await TodoTask.findById(id);

      // Check if the user is authorized
      if (task && task.userIdentifier === req.user.id) {
        task.name = req.body.name;
        task.profimg = req.body.profimg;
        task.location = req.body.location;
        task.caption = req.body.caption;

        // Handle file upload if a file is provided
        if (req.file) {
          task.mainimg = {
            data: req.file.buffer,
            contentType: req.file.mimetype,
            filename: req.file.originalname,
          };
        }

        // Save the updated task
        await task.save();

        res.redirect("/home");
      } else {
        res.status(403).send("Unauthorized");
      }
    } catch (err) {
      res.status(500).send(err);
    }
  });

app.get("/remove/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const task = await TodoTask.findById(id);

    if (!task) {
      return res.status(404).send("Task not found");
    }

    if (!req.user || task.userIdentifier !== req.user.id) {
      return res.status(403).send("Unauthorized");
    }

    await TodoTask.findByIdAndUpdate(id, { deleted: true });

    // Redirect the user back to the public page after removing the task
    res.redirect("/public");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing task");
  }
});

//VIEW DELETED POSTS (not implemented yet)
app.get("/deleted", async (req, res) => {
  try {
    const deletedTasks = await TodoTask.find({ deleted: true });
    res.render("deleted.ejs", { deletedTasks });
  } catch (err) {
    res.status(500).send(err);
  }
});

// -------------- verifyToken -----------------------
function verifyToken(req, res, next) {
  let bearerHeader = req.headers["authorization"];
  if (!bearerHeader) {
    bearerHeader = req.cookies.token;
  }
  if (typeof bearerHeader !== "undefined") {
    const bearerToken = bearerHeader.split(" ")[1];
    jwt.verify(bearerToken, process.env.JWT_SECRET, (err, authData) => {
      if (err) {
        console.error("Token verification error:", err);
        res.status(403).send("Invalid or expired token");
      } else {
        console.log("Token verified successfully:", authData);
        req.user = authData;
        next();
      }
    });
  } else {
    console.log("No token provided");
    res.status(403).send("No token provided");
  }
}

// ==== EDIT ===
app.get("/profile/edit", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    res.render("profileEdit.ejs", { user });
  } catch (error) {
    console.error("Error fetching user information:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/profile/edit", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    user.name = req.body.name;
    user.avatarUrl = req.body.avatarUrl;

    // Save the updated user information to db
    await user.save();

    res.redirect("/home");
  } catch (error) {
    console.error("Error updating user information:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/public", async (req, res) => {
  try {
    const tasks = await TodoTask.find({ deleted: false }).sort({
      createdAt: -1,
    });

    let token = null;
    let avatarUrl = null;
    let name = "anonymous";
    let userId = null; // Define userId variable

    // Check if user is authenticated
    let bearerHeader = req.headers["authorization"];
    if (!bearerHeader) {
      bearerHeader = req.cookies.token;
    }
    if (typeof bearerHeader !== "undefined") {
      const bearerToken = bearerHeader.split(" ")[1];
      jwt.verify(bearerToken, process.env.JWT_SECRET, (err, authData) => {
        if (err) {
          console.error("Token verification error:", err);
          res.status(403).send("Invalid or expired token");
        } else {
          console.log("Token verified successfully:", authData);
          token = bearerToken;
          avatarUrl = authData.avatarUrl;
          name = authData.name;
          userId = authData.id; // Set userId from authData
        }
      });
    } else {
      // Set default avatar URL if user is not signed in
      avatarUrl =
        "https://villagesonmacarthur.com/wp-content/uploads/2020/12/Blank-Avatar.png";
    }

    res.render("public.ejs", {
      todoTasks: tasks,
      token: token,
      avatarUrl: avatarUrl,
      name: name,
      userId: userId, // Pass userId to the template
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});
