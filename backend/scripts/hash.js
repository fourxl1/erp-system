const bcrypt = require("bcryptjs");

const password = process.argv[2] || "Test1234!";

bcrypt.hash(password, 10).then((hash) => {
  process.stdout.write(`${hash}\n`);
});
