/**
 * Created by Doublefinger on 4/11/16.
 */
var username = null;
var userId = null;
var own = false;
$("#message_to_client").hide();
var socket = io.connect();
socket.on("message_to_client", function (data) {
    if(!username) {
        return;
    }
    $("#message_to_client").text(data);
    $("#message_to_client").show();
});

socket.on("server_joined", function (name, id) {
    if(!username) {
        return;
    }
    username = name;
    userId = id;
    $("button").removeAttr("disabled");
    $("#username").text("Hello, " + username);
});

socket.on("total_user", function (data) {
    var count = data['count'];
    $("#total_user").text("There are " + count + " users online.");
});

socket.on("create_room_list", function (data) {
    if(!username) {
        return;
    }
    var rooms = data['rooms'];
    var count = data['count'];
    var room_list = $("#room_list");
    room_list.html("");
    for (var i = 0; i < rooms.length; i++) {
        var room = rooms[i];
        var li = document.createElement("li");
        li.setAttribute("class", "list-group-item");
        li.appendChild(document.createTextNode(room.name));
        var button = document.createElement("button");
        button.setAttribute("class", "btn btn-xs btn-success");
        button.setAttribute("id", room.name);
        button.onclick = function () {
            var id = $(this).attr("id");
            if ($(this).parent().find("button").length == 2) {
                $("#join_password").attr("room", id);
                $("#password_modal").modal('toggle');
            } else {
                socket.emit("join_room", id, null);
            }
        }
        var span = document.createElement("span");
        span.setAttribute("class", "glyphicon glyphicon-log-in");
        button.appendChild(span);
        li.appendChild(button);
        if (room.password == "true" || room.password == true) {
            var button = document.createElement("button");
            button.setAttribute("class", "btn btn-xs btn-warning");
            button.setAttribute("disabled", "disabled");
            button.setAttribute("id", room.name);
            var span = document.createElement("span");
            span.setAttribute("class", "glyphicon glyphicon-leaf");
            button.appendChild(span);
            li.appendChild(button);
        }
        room_list.append(li);
    }
    $("#room_count").text(count + " available rooms");
});

socket.on("add_room", function (data) {
    if(!username) {
        return;
    }
    var room = data['room'];
    var password = data['password'];
    var count = data['count'];

    var li = document.createElement("li");
    li.setAttribute("class", "list-group-item");
    li.appendChild(document.createTextNode(room));
    var button = document.createElement("button");
    button.setAttribute("class", "btn btn-xs btn-success join_room");
    button.setAttribute("id", room);
    button.onclick = function () {
        var id = $(this).attr("id");
        if ($(this).parent().find("button").length == 2) {
            $("#join_password").attr("room", id);
            $("#password_modal").modal('toggle');
        } else {
            socket.emit("join_room", id, null);
        }
    }
    var span = document.createElement("span");
    span.setAttribute("class", "glyphicon glyphicon-log-in");
    button.appendChild(span);
    li.appendChild(button);
    if (password == "true" || password == true) {
        var button = document.createElement("button");
        button.setAttribute("class", "btn btn-xs btn-warning");
        button.setAttribute("disabled", "disabled");
        button.setAttribute("id", room.name);
        var span = document.createElement("span");
        span.setAttribute("class", "glyphicon glyphicon-leaf");
        button.appendChild(span);
        li.appendChild(button);
    }
    $("#room_list").append(li);
    $("#room_count").text(count + " available rooms");
});

socket.on("remove_room", function (data) {
    if(!username) {
        return;
    }
    var room = data['room'];
    var count = data['count'];
    $("#" + room).parent().remove();
    $("#room_count").text(count + " available rooms");
});

socket.on("room_identifier", function (room_name, owner) {
    if(!username) {
        return;
    }
    if(room_name  == ""){
        $("#room_name").text("Room:");
    } else {
        $("#room_name").text("Room: " + room_name + "     Owner: " + owner);
    }
});

socket.on("create_room_user_list", function (data) {
    if(!username) {
        return;
    }
    var users = data['users'];
    var owner = data['owner'];
    var count = data['count'];
    if (owner == userId) {
        own = true;
    } else {
        own = false;
    }
    var user_list = $("#user_list");
    user_list.html("");
    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var li = document.createElement("li");
        li.setAttribute("class", "list-group-item");
        li.setAttribute("id", user.id.substring(2));
        li.appendChild(document.createTextNode(user.name));
        if(user.id == userId) {
            user_list.append(li);
            continue;
        }
        var button = document.createElement("button");
        button.setAttribute("class", "btn btn-xs btn-success");
        button.setAttribute("id", user.id);
        button.onclick = function() {
            $("#send_whisper").attr("user", $(this).attr("id"));
            $("#whisper_modal").modal('toggle');
        }
        var span = document.createElement("span");
        span.setAttribute("class", "glyphicon glyphicon-comment");
        button.appendChild(span);
        li.appendChild(button);
        if (own) {
            button = document.createElement("button");
            button.setAttribute("class", "btn btn-xs btn-warning kick_user");
            button.onclick = function () {
                socket.emit("kick_from_room", user.id);
            }
            var span = document.createElement("span");
            span.setAttribute("class", "glyphicon glyphicon-remove");
            button.appendChild(span);
            li.appendChild(button);
            button = document.createElement("button");
            button.setAttribute("class", "btn btn-xs btn-danger ban_user");
            button.onclick = function () {
                socket.emit("ban_from_room", user.id);
            }
            var span = document.createElement("span");
            span.setAttribute("class", "glyphicon glyphicon-thumbs-down");
            button.appendChild(span);
            li.appendChild(button);
            if (user.id != owner) {
                button = document.createElement("button");
                button.setAttribute("class", "btn btn-xs btn-primary promote_user");
                button.onclick = function () {
                    socket.emit("promote_to_owner",  user.id);
                }
                var span = document.createElement("span");
                span.setAttribute("class", "glyphicon glyphicon-hand-up");
                button.appendChild(span);
                li.appendChild(button);
            }
        }

        user_list.append(li);
    }
    $("#user_count").text(count + " users online");
});

socket.on("add_user", function (data) {
    if(!username) {
        return;
    }
    var user = data['user'];
    var id = data['id'];
    var count = data['count'];

    var li = document.createElement("li");
    li.setAttribute("class", "list-group-item");
    li.setAttribute("id", id.substring(2));
    li.appendChild(document.createTextNode(user));
    var button = document.createElement("button");
    button.setAttribute("class", "btn btn-xs btn-success");
    button.onclick = function() {
        $("#send_whisper").attr("user", id);
        $("#whisper_modal").modal('toggle');
    }
    var span = document.createElement("span");
    span.setAttribute("class", "glyphicon glyphicon-comment");
    button.appendChild(span);
    li.appendChild(button);
    if (own) {
        button = document.createElement("button");
        button.setAttribute("class", "btn btn-xs btn-warning kick_user");
        button.onclick = function () {
            socket.emit("kick_from_room", id);
        }
        var span = document.createElement("span");
        span.setAttribute("class", "glyphicon glyphicon-remove");
        button.appendChild(span);
        li.appendChild(button);
        button = document.createElement("button");
        button.setAttribute("class", "btn btn-xs btn-danger ban_user");
        button.onclick = function () {
            socket.emit("ban_from_room", id);
        }
        var span = document.createElement("span");
        span.setAttribute("class", "glyphicon glyphicon-thumbs-down");
        button.appendChild(span);
        li.appendChild(button);
        button = document.createElement("button");
        button.setAttribute("class", "btn btn-xs btn-primary promote_user");
        button.onclick = function () {
            socket.emit("promote_to_owner", id);
        }
        var span = document.createElement("span");
        span.setAttribute("class", "glyphicon glyphicon-hand-up");
        button.appendChild(span);
        li.appendChild(button);
    }
    $("#user_list").append(li);
    $("#user_count").text(count + " users online");
});

socket.on("remove_user", function (data) {
    if(!username) {
        return;
    }
    var user = data['user'];
    var owner = data['owner'];
    var count = data['count'];
    $("#" + user.substring(2)).remove();
    $("#user_count").text(count + " users online");
    //if(owner == userId) {
    //    own = true;
    //    //update UI for the new owner
    //    var lis =  $("#user_list").find("li").append();
    //
    //    var button = document.createElement("button");
    //    button.setAttribute("class", "btn btn-xs btn-success kick_user");
    //    button.onclick = function () {
    //        socket.emit("kick_from_room", "/#" + id);
    //    }
    //    var span = document.createElement("span");
    //    span.setAttribute("class", "glyphicon glyphicon-remove");
    //    button.appendChild(span);
    //    lis.appendChild(button);
    //    button = document.createElement("button");
    //    button.setAttribute("class", "btn btn-xs btn-success ban_user");
    //    button.onclick = function () {
    //        socket.emit("ban_from_room", "/#" + id);
    //    }
    //    var span = document.createElement("span");
    //    span.setAttribute("class", "glyphicon glyphicon-thumbs-down");
    //    button.appendChild(span);
    //    lis.appendChild(button);
    //    button = document.createElement("button");
    //    button.setAttribute("class", "btn btn-xs btn-success promote_user");
    //    button.onclick = function () {
    //        socket.emit("promote_to_owner", "/#" + id);
    //    }
    //    var span = document.createElement("span");
    //    span.setAttribute("class", "glyphicon glyphicon-hand-up");
    //    button.appendChild(span);
    //    lis.appendChild(button);
    //}
});

socket.on("remove_room_user_list", function () {
    if(!username) {
        return;
    }
    own = false;
    $("#user_list").html("");
});

socket.on("update_owner", function (owner) {
    if(!username) {
        return;
    }
    $("#" + owner.substring(2)).last().remove();
});

socket.on("chat", function (data) {
    if(!username) {
        return;
    }
    var user = data['user'];
    var msg = data['msg'];
    var time = convertTime(data['time']);
    var whisper = data['whisper'];
    var li = document.createElement("li");
    if (user != username) {
        li.setAttribute("class", "left clearfix");
        var span = document.createElement("span");
        span.setAttribute("class", "chat-img pull-left");
        var img = document.createElement("img");
        if (whisper == "false" || !whisper) {
            img.setAttribute("src", "http://placehold.it/50/7BCC70/fff&text=P");
        } else {
            img.setAttribute("src", "http://placehold.it/50/55C1E7/fff&text=W");
        }
        img.setAttribute("class", "img-circle");
        span.appendChild(img);
        li.appendChild(span);
        var div1 = document.createElement("div");
        div1.setAttribute("class", "chat-body clearfix");
        var div2 = document.createElement("div");
        div2.setAttribute("class", "header");
        var strong = document.createElement("strong");
        strong.setAttribute("class", "primary-font");
        strong.appendChild(document.createTextNode(user));
        var small = document.createElement("small");
        small.setAttribute("class", "pull-right text-muted");
        span = document.createElement("span");
        span.setAttribute("class", "glyphicon glyphicon-time");
        small.appendChild(span);
        small.appendChild(document.createTextNode(time));
        div2.appendChild(strong);
        div2.appendChild(small);
        var p = document.createElement("p");
        p.appendChild(document.createTextNode(msg));
        div1.appendChild(div2).appendChild(p);
        li.appendChild(div1);
    } else {
        li.setAttribute("class", "right clearfix");
        var span = document.createElement("span");
        span.setAttribute("class", "chat-img pull-right");
        var img = document.createElement("img");
        img.setAttribute("src", "http://placehold.it/50/FA6F57/fff&text=ME");
        img.setAttribute("class", "img-circle");
        span.appendChild(img);
        li.appendChild(span);
        var div1 = document.createElement("div");
        div1.setAttribute("class", "chat-body clearfix");
        var div2 = document.createElement("div");
        div2.setAttribute("class", "header");
        var strong = document.createElement("strong");
        strong.setAttribute("class", "pull-right primary-font");
        strong.appendChild(document.createTextNode(user));
        var small = document.createElement("small");
        small.setAttribute("class", "text-muted");
        span = document.createElement("span");
        span.setAttribute("class", "glyphicon glyphicon-time");
        small.appendChild(span);
        small.appendChild(document.createTextNode(time));
        div2.appendChild(small);
        div2.appendChild(strong);
        var p = document.createElement("p");
        p.appendChild(document.createTextNode(msg));
        div1.appendChild(div2).appendChild(p);
        li.appendChild(div1);
    }
    $('.chat').append(li);
});

$("#create_room").click(function () {
    var name = $("#room_name_input").val();
    var password = $("#room_password").val();
    if (password == "") {
        password = null;
    }
    socket.emit("create_room", name, password);
    $("#create_modal").modal('hide');
});

$("#leave_room").click(function () {
    socket.emit("leave_room");
});

$("#join_password").click(function () {
    var id = $(this).attr("room");
    var password = $("#password_to_join").val();
    socket.emit("join_room", id, password);
    $("#password_modal").modal('hide');
});

$("#send_whisper").click(function () {
    var id = $(this).attr("user");
    var message = $("#whisper").val();
    socket.emit("send", id, message, new Date().getTime());
    $("#whisper_modal").modal('hide');
});

$("#send_btn").click(function () {
    var message = $("#message").val();
    socket.emit("send", null, message, new Date().getTime());
});

$("#sign_in").click(function () {
    username = $("#username_input").val();
    socket.emit("join_server", username);
    $("#sign_in_modal").modal('hide');
});

function convertTime(time) {
    var mark = new Date(time);
    return mark.getHours() + ":" + mark.getMinutes();
}