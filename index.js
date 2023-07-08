import Express, { query }  from "express";
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

mongoose.connect("mongodb://localhost:27017/test").then(()=>{
    console.log("Database Connected")});


let messagesSchema= new mongoose.Schema({
    userName:String,
    message:String
})
let credentialSchema= new mongoose.Schema({
    userName:String,
    password:String
})
let roomsSchema= new mongoose.Schema({
    roomName:String,
})
let privateMessageSchema= new mongoose.Schema({
    from:String,
    to:String,
    message:String
})
let rooms= new mongoose.model("roomsdata",roomsSchema);
let messages = new mongoose.model("messagedb",messagesSchema);
let accounts= new mongoose.model("credentials",credentialSchema);
let privateMessages= new mongoose.model("privatemessagedb",privateMessageSchema);
let userData={};
let userDataByUserName={};
let databases=[];
//Sockets
io.on("connection",(socket)=>{
    userData[socket.id]=socket.handshake.query.username;
    userDataByUserName[socket.handshake.query.username]=socket.id;
    // console.log(socket.handshake.query.username)
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
    socket.on('private-message',data=>{
        let fromUser=data.from;
        let toUser=data.to;
        let msg=data.message;
        privateMessages.create({from:fromUser,to:toUser,message:msg});
        io.to(userDataByUserName[fromUser]).emit('new-private-message',{
             "from":fromUser,
             "message":msg
        })
        io.to(userDataByUserName[toUser]).emit('new-private-message',{
            "from":fromUser,
            "message":msg
       })

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

    console.log(req)
    messages.find({})
        .then((data)=>{
            res.json(data)
        })
        .catch(e=>console.log(e))
})
app.get("/allPrivateMessage",(req,res)=>{
    let user1=req.query.user1;
    let user2=req.query.user2;

    let query={
        $or:[
            { from: user1, to: user2 },
            { from: user2, to: user1 }
        ]
    }
    privateMessages.find(query).then(data=>{
        res.json(data);
    }).catch(e=>console.log(e))

})
app.get("/getChats",(req,res)=>{
    let user1=req.query.user1;
    let query={
        $or:[
            { from: user1},
            { to: user1 }
        ]
    }
    privateMessages.find(query).then(data=>{
        res.json(data);
    }).catch(e=>console.log(e))
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

app.post("/findUser",(req,res)=>{
    let user=req.body.user;
    accounts.find({userName:user}).then(data=>{
        if(data.length!=0)
        res.send(true);
        else
        res.send(false);
    }).catch(e=>console.log(e))
})

app.post("/createChat",(req,res)=>{
    let user1=req.body.user1;
    let user2=req.body.user2;
    privateMessages.create({from:user1,to:user2,message:""}).then(()=>{
        res.sendStatus(200);
    }).catch(e=>console.log(e))
})

server.listen(80,()=>{
    console.log("Server Started")
})