var express = require('express');
var socket_io = require('socket.io');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var validator = require('validator');
var _ = require('underscore')._;
var Room = require('./room.js');
var User = require('./user.js');

var app = express();

var io = socket_io();
app.io = io;

var routes = require('./routes/index');
var users = require('./routes/users');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

var rooms = {};
var users = {};
var sockets = [];

function updateUserList(room) {
    var users_in_room = [];
    for (var i = 0; i < room.people.length; i++) {
        users_in_room.push({
            "id": room.people[i],
            "name": users[room.people[i]].name
        });
    }
    return users_in_room;
}

function getRoomList() {
    var room_names = [];
    for (var index in rooms) {
        var room = rooms[index];
        if (room.checkPassword(null)) {
            //no password
            room_names.push({name: room.name, password: false});
        } else {
            room_names.push({name: room.name, password: true});
        }
    }
    return room_names;
}

//inspired by https://github.com/tamaspiros/advanced-chat
io.on('connection', function (socket) {
    //return room list when user logged in
    socket.on("join_server", function (name) {
        if (!name) {
            socket.emit("message_to_client", "Please sign in first");
            return;
        }
        var exists = false;
        var name = validator.escape(name);
        _.find(users, function (key) {
            if (key.name.toLowerCase() === name.toLowerCase())
                return exists = true;
        });
        if (exists) {
            socket.emit("message_to_client", "The user name already exists.");
        } else {
            var user = new User(name, socket.id);
            users[socket.id] = user;
            //broadcast to all users
            io.emit("message_to_client", user.name + " is online.");
            io.emit("total_user", {count: _.size(users)});
            //message to sender
            socket.emit("message_to_client", "You have connected to the server.");
            socket.emit("create_room_list", {rooms: getRoomList(), count: _.size(rooms)});
            socket.emit("server_joined", name, socket.id);
            sockets.push(socket);
        }
    });

    socket.on("disconnect", function () {
        if (typeof users[socket.id] !== "undefined") {
            var user = users[socket.id];
            var name = user.inroom;
            if (name) {
                var room = rooms[name];
                room.removePerson(socket.id);
                //check if the user is the owner of the room
                //remember the last one who left the room must be the owner
                if (user.ownsRoom(name)) {
                    if (room.isEmpty()) {
                        delete room;
                        io.emit("remove_room", {room: name, count: _.size(rooms)});
                        io.emit("message_to_client", "Room: " + name + "has been removed");
                    } else {
                        //tranfer the onwership to the next owner
                        var new_ownerID = room.transferOwner(false);
                        io.to(name).emit("message_to_client", "The owner of room is transferred to " + users[new_ownerID].name + ".");
                    }
                }
                io.to(name).emit("message_to_client", "User: " + user.name + " has left the room.");
                io.to(name).emit("remove_user", {
                    user: socket.id,
                    owner: room.owner,
                    count: _.size(room.people)
                });
            }
            delete users[socket.id];
            io.emit("total_user", {count: _.size(users)});
        }
    });

    socket.on("create_room", function (room_name, password) {
        if (users[socket.id].inroom) {
            socket.emit("message_to_client", "You are in a room, please leave it first to create your own.");
        } else if (users[socket.id].owns) {
            socket.emit("message_to_client", "You have already created a room");
        } else {
            if(!room_name.match(/^[A-Za-z]+[\w\-\:\.]*$/)){
                socket.emit("message_to_client", "Room name must start with an alphabet letter.");
                return;
            }
            var name = validator.escape(room_name);
            if (rooms[name]) {
                socket.emit("message_to_client", "Room name already exists.");
            } else {
                var password = password;
                if (!password || password === "") {
                    password = null;
                } else {
                    password = validator.escape(password);
                }
                var room = new Room(name, socket.id, password);
                rooms[name] = room;
                if (password) {
                    io.emit("add_room", {room: name, password: true, count: _.size(rooms)});
                } else {
                    io.emit("add_room", {room: name, password: false, count: _.size(rooms)});
                }
                socket.join(name);
                users[socket.id].owns = name;
                users[socket.id].inroom = name;
                room.addPerson(socket.id);
                socket.emit("message_to_client", "Room " + name + " has been successfully created.");
                socket.emit("room_identifier", name, users[socket.id].name);
                io.to(name).emit("create_room_user_list", {
                    users: updateUserList(room),
                    owner: socket.id,
                    count: _.size(room.people)
                });
            }
        }
    });

    socket.on("join_room", function (room_name, password) {
        if (users[socket.id].inroom) {
            socket.emit("message", "You are in a room, please leave it first to join another.");
        } else {
            var name = validator.escape(room_name);
            var room = rooms[name];
            if (!room) {
                socket.emit("message_to_client", "The room does not exist.");
                return;
            }
            if (room.inBlacklist(socket.id)) {
                socket.emit("message_to_client", "You have been banned by the owner of the room");
                return;
            }
            if (!room.checkPassword(password)) {
                socket.emit("message_to_client", "Wrong password.");
                return;
            }
            var user = users[socket.id];
            users[socket.id].inroom = name;
            room.addPerson(socket.id);
            io.to(name).emit("message_to_client", user.name + " has connected to " + name + ".");
            io.to(name).emit("add_user", {
                user: user.name,
                id: user.id,
                count: _.size(room.people)
            });
            socket.join(name);
            socket.emit("create_room_user_list", {
                users: updateUserList(room),
                owner: room.owner,
                count: _.size(room.people)
            });
            socket.emit("message_to_client", "Welcome to room: " + name + ".");
            socket.emit("room_identifier", name, users[room.owner].name);
        }
    });

    socket.on("leave_room", function () {
        var user = users[socket.id];
        var name = user.inroom;
        if (!name) {
            socket.emit("message_to_client", "You are not in a room.");
        } else {
            var room = rooms[name];
            socket.leave(name);
            room.removePerson(socket.id);
            user.inroom = null;
            //check if the user is the owner of the room
            //remember the last one who left the room must be the owner
            if (user.ownsRoom(name)) {
                user.owns = null;
                if (room.isEmpty()) {
                    delete room.blacklist;
                    delete room;
                    io.emit("remove_room", {room: name, count: _.size(rooms)});
                    io.emit("message_to_client", "Room: " + name + " has been removed");
                } else {
                    //tranfer the onwership to the next owner
                    var new_ownerID = room.transferOwner(false);
                    io.to(name).emit("message_to_client", "The owner of room is transferred to " + users[new_ownerID].name + ".");
                    io.to(name).emit("update_owner", new_ownerID);
                    io.to(name).emit("room_identifier", name, users[new_ownerID].name);

                }
            }
            io.to(name).emit("message_to_client", "User: " + user.name + " has left the room.");
            io.to(name).emit("remove_user", {
                user: socket.id,
                owner: room.owner,
                count: _.size(room.people)
            });
            socket.emit("remove_room_user_list");
            socket.emit("room_identifier", "");
            socket.emit("message_to_client", "You have left the room");
        }
    });

    socket.on("kick_from_room", function (id) {
        var user = users[socket.id];
        var name = user.owns;
        if (!name) {
            socket.emit("message_to_client", "You are not authorised.");
        } else {
            var room = rooms[name];
            var target = null;
            _.find(sockets, function (key) {
                if (key.id === id)
                    return target = key;
            });
            target.leave(name);
            target.emit("message_to_client", "You have been kicked from the room.");
            target.emit("remove_room_user_list");
            room.removePerson(id);
            users[id].inroom = null;

            io.to(name).emit("message_to_client", "User: " + users[id].name + " has left the room.");
            io.to(name).emit("remove_user", {
                user: id,
                owner: room.owner,
                count: _.size(room.people)
            });
            socket.emit("room_identifier", "", "");
        }
    });

    socket.on("ban_from_room", function (id) {
        var user = users[socket.id];
        var name = user.owns;
        if (!name) {
            socket.emit("message_to_client", "You are not authorised.");
        } else {
            var room = rooms[name];
            var target = null;
            _.find(sockets, function (key) {
                if (key.id === id)
                    return target = key;
            });
            target.leave(name);
            target.emit("You have been banned from the room.");
            target.emit("remove_room_user_list");
            room.removePerson(id);
            room.addToBlacklist(id);
            users[id].inroom = null;

            io.to(name).emit("message_to_client", "User: " + users[id].name + " has left the room.");
            io.to(name).emit("remove_user", {
                user: id,
                owner: room.owner,
                count: _.size(room.people)
            });
            socket.emit("room_identifier", "", "");
        }
    });

    socket.on("promote_to_owner", function (id) {
        var user = users[socket.id];
        var targetUser = users[id];
        var name = user.owns;
        if (!name) {
            socket.emit("message_to_client", "You are not authorised.");
        } else {
            user.owns = null;
            targetUser.owns = name;
            rooms[name].owner = id;
            io.to(name).emit("update_owner");
            io.to(name).emit("room_identifier", name, users[id].name);
            io.to(name).emit("message_to_client", "The owner of room is transferred to " + targetUser.name + ".");
            var target = null;
            _.find(sockets, function (key) {
                if (key.id === receiver)
                    return target = key;
            });
            target.emit("message_to_client", "You become the owner of the room.");
        }
    });

    socket.on("send", function (receiver, message, time) {
        var msg = validator.escape(message);
        var user = users[socket.id];
        if (!receiver || receiver === "") {
            //boardcast in the room
            io.to(user.inroom).emit("chat", {user: user.name, msg: msg, time: time, whisper: false});
        } else {
            //whisper
            console.log("enter");
            var target = null;
            _.find(sockets, function (key) {
                if (key.id === receiver)
                    return target = key;
            });
            target.emit("chat", {user: user.name, msg: msg, time: time, whisper: true});
            socket.emit("chat", {user: user.name, msg: msg, time: time, whisper: true});
        }
    });
});


module.exports = app;
