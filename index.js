import Express  from "express";
import mongoose from "mongoose";
import cors from "cors";
import {Server} from "socket.io";
import http from "http";
import { SocketAddress } from "net";
import { connect } from "http2";
let app=Express();
app.use(Express.json());
app.use(cors());
let server=http.createServer(app);
let io = new Server(server,{cors:{origin:"*"}});

mongoose.connect("mongodb://localhost:27017/test").then(()=>{console.log("Database Connected")});


let messagesSchema= new mongoose.Schema({
    userName:String,
    message:String
})
let credentialSchema= new mongoose.Schema({
    userName:String,
    password:String
})

let messages = new mongoose.model("messagedb",messagesSchema);
let accounts= new mongoose.model("credentials",credentialSchema);
let userData={};
//Sockets
io.on("connection",(socket)=>{
    userData[socket.id]=socket.handshake.query.username;
    console.log(socket.handshake.query.username)
    socket.on("message-sent",message=>{
        console.log("message broadcasted "+message)
        messages.create({userName:userData[socket.id],message:message})
        io.emit("new-message",{
            "name":userData[socket.id],
            "message":message
        });
    })
    socket.on('disconnect',()=>{
        delete userData[socket.id];
    })
})



//Adds messages to database
app.post("/addMessage",(req,res)=>{
    let user=req.body.name;
    let Message=req.body.message;
    messages.create({userName:user,message:Message})
    .then(()=>{
        console.log("Added");
        res.sendStatus(200)
    })
    .catch(e=>{console.log(e)
        res.sendStatus(500)
    })
})
//Retrieve data from database
app.get("/allMessage", (req,res)=>{
    console.log("somebody asked")
    messages.find({})
        .then((data)=>{
            res.json(data)
        })
        .catch(e=>console.log(e))
})
//Check user-exists or not:
app.post('/login',(req,res)=>{
    let user=req.body.userName;
    let pass=req.body.password;
    accounts.find({userName:user})
    .then((data)=>{

        if(data.length==1)
        {
            if(data[0].password==pass)
            res.sendStatus(200);  //Password Match
            else
            res.sendStatus(403)  //Forbidden, incorrect password, try again.
        }
        else
        {
            res.sendStatus(404); //Not Found, User not found , redirect to signup page.
        }
    })
    .catch(e=>{console.log(e)
        res.sendStatus(500); //Internal error
    })


})
app.post("/signup",async (req,res)=>{
    let user=req.body.userName;
    let pass=req.body.password;
    let data=await accounts.find({userName:user});
    if(data.length!=0)
    {
        // User already exists 
        res.sendStatus(403);
    }
    else
    {
        accounts.create({userName:user,password:pass}).then(()=>{
            res.sendStatus(201);
        }).catch(e=>{
            res.sendStatus(500); //Internal Error;
        })
    }
})

server.listen(80,()=>{
    console.log("Server Started")
})