/**
 * Created by Doublefinger on 4/10/16.
 */

function User(name, id) {
    this.name = name;
    this.id = id;
    this.owns = null;
    this.inroom = null;
    //this.blacklist = [];
};

User.prototype.ownsRoom = function(room_name){
    return this.owns = room_name;
};
//
//User.prototype.joinRoom = function(room_name){
//    this.inroom = room_name;
//};

//User.prototype.mute = function(personID) {
//    this.blacklist.push(personID);
//};
//
//User.prototype.unmute = function(personID) {
//    for(var i = 0; i < this.people.length; i++){
//        if(this.blacklist[i] === personID){
//            this.blacklist.remove(i);
//            return;
//        }
//    }
//};

module.exports = User;