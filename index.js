const mongoose = require("mongoose");

const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();

const TodoTask = require("./models/TodoTask");

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.URI);
  console.log("Connected to db!");
  app.listen(3122, () => console.log("Server Up and running"));
}

app.set("view engine", "ejs");
app.use("/static", express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.get("/api/posts", async (req, res) => {
  try {
    const posts = await util.read(URI, DATABASE, POSTS, {});
    res.json(posts); //  JSON response
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to retrieve posts" });
  }
});
// CRUD processing

app
  .route("/")
  .get(async (req, res) => {
    try {
      const tasks = await TodoTask.find({ deleted: false });
      res.render("todo.ejs", { todoTasks: tasks });
    } catch (err) {
      console.error(err);
    }
  })
  .post(async (req, res) => {
    const todoTask = new TodoTask({
      name: req.body.name,
      profimg: req.body.profimg,
      mainimg: req.body.mainimg,
      location: req.body.location,
      caption: req.body.caption,
    });
    try {
      await todoTask.save();
      res.redirect("/");
    } catch (err) {
      res.send(500, err);
    }
  });

/* app.get("/", async (req, res) => {
  try {
    const tasks = await TodoTask.find({})
    res.render("todo.ejs", { todoTasks: tasks });
  }
  catch (err) {
    console.error(err);
  }
});

app.post('/', async (req, res) => {
    const todoTask = new TodoTask({
        title: req.body.title
    });
    try {
      await todoTask.save();
      res.redirect("/");
    } catch (err) {
      res.send(500, err);
    }
});
*/

//UPDATE
app
  .route("/edit/:id")
  .get(async (req, res) => {
    const id = req.params.id;
    try {
      let tasks = await TodoTask.find({});
      res.render("todoEdit.ejs", { todoTasks: tasks, idTask: id });
    } catch (err) {
      res.send(500, err);
    }
  })
  .post(async (req, res) => {
    const id = req.params.id;
    try {
      await TodoTask.findByIdAndUpdate(id, { title: req.body.title });
      res.redirect("/");
    } catch (err) {
      res.send(500, err);
    }
  });

//DELETE
app.route("/remove/:id").get(async (req, res) => {
  const id = req.params.id;
  try {
    await TodoTask.findByIdAndUpdate(id, { deleted: true });

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing task");
  }
});

//VIEW DELETED POSTS
app.get("/deleted", async (req, res) => {
  try {
    const deletedTasks = await TodoTask.find({ deleted: true });
    res.render("deleted.ejs", { deletedTasks });
  } catch (err) {
    res.status(500).send(err);
  }
});
