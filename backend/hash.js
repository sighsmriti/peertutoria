const bcrypt = require("bcrypt");

async function run() {
    const password = "test123";
    const hash = await bcrypt.hash(password, 10);
    console.log(hash);
}

run();
