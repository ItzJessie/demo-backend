const mongoose = require("mongoose");

const connectionString = process.env.MONGODB_URI || "mongodb://localhost/testdb";

// testdb is the database name and will be created automatically
mongoose
  .connect(connectionString)
  .then(() => console.log("Connected to mongodb..."))
  .catch((err) => console.error("could not connect to mongodb...", err.message));

const schema = new mongoose.Schema({
  name: String,
});

// this creates a Message class in our app
const Message = mongoose.model("Message", schema);
const message = new Message({
  name: "Hello World",
});

async function createMessage() {
  try {
    const result = await message.save();
    console.log(result);
  } catch (err) {
    console.error("Could not save message:", err.message);
  }
}

createMessage();