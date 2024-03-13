const ID = "test";
const PASSWORD = "test";
const NET = "cluster0.9jg3dqa.mongodb.net";
const databaseName = "todoapp";

// Connection URI
const URI = `mongodb+srv://${ID}:${PASSWORD}@${NET}/?retryWrites=true&w=majority`;

module.exports.URI = URI;
module.exports.databaseName = databaseName;
