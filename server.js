const WebSocket = require("ws");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 8080;

// اتصال به Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

const PASSWORD_SECRET = process.env.PASSWORD_SECRET;

const http = require("http");

const httpServer = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("OnlineGame server is running!");
});

const server = new WebSocket.Server({
    server: httpServer
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on port ${PORT}`);
});


// تبدیل رمز به مقدار غیرقابل‌مشاهده برای ذخیره در دیتابیس
function hashPassword(password) {
    return crypto
        .createHmac("sha256", PASSWORD_SECRET)
        .update(password)
        .digest("hex");
}


// تبدیل اسم به دقیقاً 15 کاراکتر
function formatName(name) {
    if (name.length > 15) {
        return name.substring(0, 15);
    }

    return name.padEnd(15, " ");
}


server.on("connection", (socket) => {

    console.log("A player connected!");
    socket.send("CONNECTED_TO_SERVER");


    socket.on("message", async (message) => {

        const text = message.toString();

        console.log("Received:", text);


        // =========================
        // REGISTER
        // REGISTER|password|name
        // =========================

        if (text.startsWith("REGISTER|")) {

            const parts = text.split("|");

            if (parts.length !== 3) {
                socket.send("REGISTER_ERROR");
                return;
            }

            const password = parts[1];
            const name = parts[2];


            // رمز باید دقیقاً 10 کاراکتر باشد
            if (password.length !== 10) {
                socket.send("PASSWORD_LENGTH_ERROR");
                return;
            }


            // جلوگیری از | داخل نام
            if (name.includes("|")) {
                socket.send("NAME_ERROR");
                return;
            }


            // اسم باید حداقل یک کاراکتر داشته باشد
            if (name.length === 0) {
                socket.send("NAME_ERROR");
                return;
            }


            const formattedName = formatName(name);
            const passwordHash = hashPassword(password);


            // بررسی اینکه رمز قبلاً ثبت شده یا نه
            const { data: existingUser, error: searchError } =
                await supabase
                    .from("users")
                    .select("id")
                    .eq("password_hash", passwordHash)
                    .maybeSingle();


            if (searchError) {
                console.log("Supabase search error:", searchError);
                socket.send("SERVER_ERROR");
                return;
            }


            if (existingUser) {
                socket.send("PASSWORD_EXISTS");
                return;
            }


            // ذخیره کاربر جدید
            const { error: insertError } = await supabase
                .from("users")
                .insert([
                    {
                        name: formattedName,
                        password_hash: passwordHash
                    }
                ]);


            if (insertError) {
                console.log("Supabase insert error:", insertError);
                socket.send("SERVER_ERROR");
                return;
            }


            console.log("New player registered:", formattedName);

            socket.send("REGISTER_OK");

            return;
        }



        // =========================
        // GET_NAME
        // GET_NAME|password
        // =========================

        if (text.startsWith("GET_NAME|")) {

            const parts = text.split("|");

            if (parts.length !== 2) {
                socket.send("GET_NAME_ERROR");
                return;
            }

            const password = parts[1];


            // رمز باید دقیقاً 10 کاراکتر باشد
            if (password.length !== 10) {
                socket.send("PASSWORD_LENGTH_ERROR");
                return;
            }


            const passwordHash = hashPassword(password);


            const { data: user, error } = await supabase
                .from("users")
                .select("name")
                .eq("password_hash", passwordHash)
                .maybeSingle();


            if (error) {
                console.log("Supabase lookup error:", error);
                socket.send("SERVER_ERROR");
                return;
            }


            if (!user) {
                socket.send("NAME_NOT_FOUND");
                return;
            }


            // نام قبلاً 15 کاراکتر ذخیره شده است
            socket.send("NAME|" + user.name);

            return;
        }



        // =========================
        // پیام‌های معمولی قبلی
        // =========================

        server.clients.forEach((client) => {

            if (client.readyState === WebSocket.OPEN) {
                client.send(text);
            }

        });

    });


    socket.on("close", () => {
        console.log("A player disconnected.");
    });

});
