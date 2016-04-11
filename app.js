var express = require('express');
var socket_io = require('socket.io');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var validator = require('validator');
var underscore = require('underscore');
var Room = require('room.js');
var User = require('user.js');

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

io.on('connection', function (socket) {
    //return room list when user logged in
    socket.on("join_server", function (name) {
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
            socket.emit("room_list", {rooms: rooms, count: _.size(rooms)});
            sockets.push(socket);
        }
    });

    socket.on("create_room", function (room_name, password) {
        if (users[socket.id].inroom) {
            socket.emit("message_to_client", "You are in a room, please leave it first to create your own.");
        } else if (users[socket.id].owns) {
            socket.emit("message_to_client", "You have already created a room");
        } else {
            var name = validator.escape(room_name);
            var password = validator.escape(password);
            if (rooms[name]) {
                socket.emit("message_to_client", "The room name already exists.");
            } else {
                if (!password || password === "") {
                    password = null;
                }
                var room = new Room(name, socket.id, password);
                rooms[name] = room;
                io.emit("room_list", {rooms: rooms, count: _.size(rooms)});
                socket.join(name);
                users[socket.id].owns = id;
                users[socket.id].inrooms = id;
                room.addPerson(socket.id);
                socket.emit("message_to_client", "Room " + name + " has been successfully created.");
                socket.emit("room_identifier", {identifier: name});
                io.to(name).emit("room_user_list", {
                    users: updateUserList(room),
                    owner: users[socket.id].name,
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
            if (room.checkPassword(password)) {
                socket.emit("message_to_client", "Wrong password.");
                return;
            }
            var user = users[socket.id];
            room.addPerson(socket.id);
            socket.join(name);
            io.to(name).emit("message_to_client", user.name + " has connected to " + name + ".");
            io.to(name).emit("room_user_list", {
                users: updateUserList(room),
                owner: users[room.owns].name,
                count: _.size(room.people)
            });
            socket.emit("message_to_client", "Welcome to room: " + name + ".");
            socket.emit("room_identifier", {identifier: name});

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
                    delete room;
                    io.emit("room_list", {rooms: rooms, count: _.size(rooms)});
                    io.emit("message_to_client", "Room: " + name + "has been removed");
                } else {
                    //tranfer the onwership to the next owner
                    var new_ownerID = room.transferOwner(false);
                    io.to(name).emit("message_to_client", "The owner of room is transferred to " + users[new_ownerID].name + ".");
                }
            }
            io.to(name).emit("message_to_client", "User: " + user.name + "has left the room.");
            io.to(name).emit("room_user_list", {
                users: updateUserList(room),
                owner: users[room.owns].name,
                count: _.size(room.people)
            });
        }
    });

    //socket.on('remove_room', function (room_name) {
    //    var name = validator.escape(room_name);
    //    var room = rooms[name];
    //    if(!room) {
    //        socket.emit("message_to_client", "The room does not exist.");
    //    } else {
    //        for(var i = 0; i < room.people.length; i++) {
    //
    //        }
    //        //remove everyone out of room
    //        delete room;
    //        io.emit("room_list", {rooms: rooms, count: _.size(rooms)});
    //        io.emit("message_to_client", "Room: " + name + "has been removed");
    //    }
    //});

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
            target.emit("You have been kicked from the room.");
            room.removePerson(id);
            users[id].inroom = null;

            io.to(name).emit("message_to_client", "User: " + users[id].name + "has left the room.");
            io.to(name).emit("room_user_list", {
                users: updateUserList(room),
                owner: users[room.owns].name,
                count: _.size(room.people)
            });

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
            room.removePerson(id);
            room.addToBlacklist(id);
            users[id].inroom = null;

            io.to(name).emit("message_to_client", "User: " + users[id].name + "has left the room.");
            io.to(name).emit("room_user_list", {
                users: updateUserList(room),
                owner: users[room.owns].name,
                count: _.size(room.people)
            });
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
            io.to(name).emit("message_to_client", "The owner of room is transferred to " + targetUser.name + ".");
            var target = null;
            _.find(sockets, function (key) {
                if (key.id === receiver)
                    return target = key;
            });
            target.emit("message_to_client", "You become the owner of the room.");
        }
    });

    socket.on("send", function (receiver, message) {
        var msg = validator.escape(message);
        var user = users[socket.id];
        if (!receiver || receiver === "") {
            //boardcast in the room
            io.to(user.inroom).emit("chat", user.name + ": " + msg);
        } else {
            //whisper
            var target = null;
            _.find(sockets, function (key) {
                if (key.id === receiver)
                    return target = key;
            });
            target.emit("whisper", user.name + ": " + msg);
        }
    });
});


module.exports = app;
